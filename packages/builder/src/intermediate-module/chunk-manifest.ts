/**
 * Chunk manifest for tracking written chunks and enabling content-hash-based skip optimization.
 * Persisted between builds to avoid rewriting unchanged chunks.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import { z } from "zod";

/**
 * Schema for individual chunk entry in manifest
 */
const ChunkEntrySchema = z.object({
  chunkId: z.string(),
  contentHash: z.string(),
  transpiledPath: z.string(),
  mtimeMs: z.number(),
});

/**
 * Schema for chunk manifest file
 */
const ChunkManifestSchema = z.object({
  version: z.literal("v1"),
  chunks: z.record(z.string(), ChunkEntrySchema),
});

export type ChunkEntry = z.infer<typeof ChunkEntrySchema>;
export type ChunkManifest = z.infer<typeof ChunkManifestSchema>;

const MANIFEST_VERSION = "v1" as const;
const MANIFEST_FILENAME = "chunk-manifest.json";

/**
 * Load chunk manifest from disk
 */
export const loadChunkManifest = async (manifestDir: string): Promise<ChunkManifest | null> => {
  const manifestPath = join(manifestDir, MANIFEST_FILENAME);

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const fs = getPortableFS();
    const content = await fs.readFile(manifestPath);
    const parsed = ChunkManifestSchema.safeParse(JSON.parse(content));

    if (!parsed.success) {
      // Invalid manifest - return null to force full rebuild
      return null;
    }

    return parsed.data;
  } catch {
    // Failed to read manifest - return null
    return null;
  }
};

/**
 * Save chunk manifest to disk
 */
export const saveChunkManifest = async (manifestDir: string, manifest: ChunkManifest): Promise<void> => {
  const manifestPath = join(manifestDir, MANIFEST_FILENAME);

  // Ensure directory exists
  if (!existsSync(manifestDir)) {
    mkdirSync(manifestDir, { recursive: true });
  }

  const fs = getPortableFS();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
};

/**
 * Create empty manifest
 */
export const createEmptyManifest = (): ChunkManifest => ({
  version: MANIFEST_VERSION,
  chunks: {},
});

/**
 * Check if a chunk needs to be rewritten based on manifest
 */
export const shouldWriteChunk = async (
  chunkId: string,
  contentHash: string,
  manifest: ChunkManifest | null,
): Promise<boolean> => {
  if (!manifest) {
    // No manifest - write everything
    return true;
  }

  const entry = manifest.chunks[chunkId];
  if (!entry) {
    // Chunk not in manifest - write it
    return true;
  }

  if (entry.contentHash !== contentHash) {
    // Content hash changed - rewrite
    return true;
  }

  // Check if file still exists on disk
  const fs = getPortableFS();
  try {
    const exists = await fs.exists(entry.transpiledPath);
    if (!exists) {
      // File was deleted - rewrite
      return true;
    }

    // Verify file hasn't been corrupted by checking mtime/size
    const stats = await fs.stat(entry.transpiledPath);
    if (Math.abs(stats.mtime.getTime() - entry.mtimeMs) > 1000) {
      // File was modified externally - rewrite for safety
      return true;
    }

    // File exists and hasn't been modified - skip write
    return false;
  } catch {
    // Error checking file - rewrite for safety
    return true;
  }
};

/**
 * Update manifest with newly written chunk
 */
export const updateManifestEntry = (
  manifest: ChunkManifest,
  chunkId: string,
  contentHash: string,
  transpiledPath: string,
): ChunkManifest => {
  return {
    ...manifest,
    chunks: {
      ...manifest.chunks,
      [chunkId]: {
        chunkId,
        contentHash,
        transpiledPath,
        mtimeMs: Date.now(),
      },
    },
  };
};
