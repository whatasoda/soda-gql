import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../../types";
import {
  createEmptyManifest,
  loadChunkManifest,
  saveChunkManifest,
  shouldWriteChunk,
  updateManifestEntry,
} from "./chunk-manifest";

export type ChunkModule = {
  readonly chunkId: string;
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly contentHash: string;
  readonly canonicalIds: readonly string[];
  readonly imports: readonly string[];
  readonly sourceCode: string;
};

export type WrittenChunkModule = {
  readonly chunkId: string;
  readonly transpiledPath: string;
  readonly contentHash: string;
};

export type WriteChunkModulesInput = {
  readonly chunks: Map<string, ChunkModule>;
  readonly outDir: string;
};

export type WriteChunkModulesResult = {
  readonly written: Map<string, WrittenChunkModule>;
  readonly skipped: number;
};

/**
 * Write chunk modules to disk, transpiling TypeScript to JavaScript.
 * Uses manifest to skip writing chunks with unchanged content hash.
 */
export const writeChunkModules = async ({
  chunks,
  outDir,
}: WriteChunkModulesInput): Promise<Result<WriteChunkModulesResult, BuilderError>> => {
  // Create output directory
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: outDir,
    });
  }

  // Load existing manifest
  let manifest = await loadChunkManifest(outDir);
  if (!manifest) {
    manifest = createEmptyManifest();
  }

  const written = new Map<string, WrittenChunkModule>();
  let skipped = 0;

  for (const [chunkId, chunk] of chunks.entries()) {
    const { sourceCode, contentHash } = chunk;

    // Generate unique filename based on content hash
    const fileName = `${contentHash}.mjs`;
    const jsFilePath = join(outDir, fileName);

    // Check if we need to write this chunk
    const needsWrite = await shouldWriteChunk(chunkId, contentHash, manifest);

    if (!needsWrite) {
      // Chunk hasn't changed - reuse from manifest
      const existingEntry = manifest.chunks[chunkId];
      if (existingEntry) {
        written.set(chunkId, {
          chunkId,
          transpiledPath: existingEntry.transpiledPath,
          contentHash: existingEntry.contentHash,
        });
        skipped++;
        continue;
      }
    }

    // Transpile TypeScript to JavaScript using SWC
    let transpiledCode: string;
    try {
      const result = transformSync(sourceCode, {
        filename: `${contentHash}.ts`,
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: false,
          },
          target: "es2022",
        },
        module: {
          type: "es6",
        },
        sourceMaps: false,
        minify: false,
      });
      transpiledCode = result.code;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: jsFilePath,
        astPath: "",
        message: `SWC transpilation failed: ${message}`,
      });
    }

    // Write transpiled code to disk
    try {
      const fs = getPortableFS();
      await fs.writeFile(jsFilePath, transpiledCode);
      written.set(chunkId, {
        chunkId,
        transpiledPath: jsFilePath,
        contentHash,
      });

      // Update manifest with new chunk
      manifest = updateManifestEntry(manifest, chunkId, contentHash, jsFilePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: "WRITE_FAILED",
        message,
        outPath: jsFilePath,
      });
    }
  }

  // Save updated manifest
  try {
    await saveChunkManifest(outDir, manifest);
  } catch (_error) {
    // Non-fatal - log but don't fail the build
    // Manifest will be rebuilt next time
  }

  return ok({ written, skipped });
};
