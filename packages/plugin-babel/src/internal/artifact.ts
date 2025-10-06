import { resolve } from "node:path";

import {
  type BuilderArtifact,
  type BuilderArtifactElement,
  BuilderArtifactSchema,
  type CanonicalId,
  createCanonicalId,
} from "@soda-gql/builder";
import { getPortableFS, getPortableHasher } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";

export type ArtifactError = {
  type: "ArtifactError";
  code: "NOT_FOUND" | "PARSE_FAILED" | "VALIDATION_FAILED";
  path: string;
  message: string;
};

/**
 * Cache entry for loaded artifacts
 */
interface ArtifactCacheEntry {
  artifact: BuilderArtifact;
  contentHash: string;
  schemaHash: string | undefined;
  mtimeMs: number;
}

/**
 * In-memory cache for artifact files
 * Key format: `${absolutePath}:${schemaHash ?? 'default'}`
 */
const artifactCache = new Map<string, ArtifactCacheEntry>();

/**
 * Options for loading artifact files
 */
export interface LoadArtifactOptions {
  /**
   * Schema hash for cache invalidation
   * If provided and doesn't match cached entry, artifact will be reloaded
   */
  schemaHash?: string;
}

/**
 * Load and parse a builder artifact from a JSON file.
 * Uses portable FS APIs and includes content-hash-based memoization.
 *
 * Cache invalidation occurs when:
 * - File content hash changes
 * - Schema hash changes
 * - File mtime changes significantly
 * - Manual invalidation via invalidateArtifactCache()
 *
 * @param path - Path to artifact JSON file
 * @param options - Loading options including schema hash
 * @returns Result containing parsed artifact or error
 */
export const loadArtifact = async (
  path: string,
  options: LoadArtifactOptions = {},
): Promise<Result<BuilderArtifact, ArtifactError>> => {
  const resolvedPath = resolve(path);
  const cacheKey = `${resolvedPath}:${options.schemaHash ?? "default"}`;
  const fs = getPortableFS();
  const hasher = getPortableHasher();

  // Check if file exists
  if (!(await fs.exists(resolvedPath))) {
    return err({
      type: "ArtifactError",
      code: "NOT_FOUND",
      path: resolvedPath,
      message: "Artifact file not found",
    });
  }

  // Get file stats for mtime check
  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: "NOT_FOUND",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "Failed to stat file",
    });
  }

  // Check cache for valid entry
  const cached = artifactCache.get(cacheKey);
  if (cached) {
    // Verify mtime hasn't changed (allow 2ms tolerance for filesystem precision limits)
    const mtimeDiff = Math.abs(stats.mtime.getTime() - cached.mtimeMs);
    if (mtimeDiff <= 2) {
      // Mtime unchanged - cache hit, return cached artifact
      return ok(cached.artifact);
    }

    // Mtime changed - need to read file and check content hash
    // This happens when file is modified externally
  }

  // Cache miss or mtime changed - read file to check content
  let contents: string;
  try {
    contents = await fs.readFile(resolvedPath);
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: "NOT_FOUND",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "Failed to read file",
    });
  }

  // Compute content hash for cache validation
  const contentHash = hasher.hash(contents, "sha256");

  // Check if content hash matches cached entry (even though mtime changed)
  if (cached && cached.contentHash === contentHash && cached.schemaHash === options.schemaHash) {
    // Content unchanged, just update mtime and reuse artifact
    // This handles cases where file was touched but not modified
    const updatedEntry: ArtifactCacheEntry = {
      ...cached,
      mtimeMs: stats.mtime.getTime(),
    };
    artifactCache.set(cacheKey, updatedEntry);
    return ok(cached.artifact);
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: "PARSE_FAILED",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "JSON parse failed",
    });
  }

  // Validate schema
  let validated: BuilderArtifact;
  try {
    validated = BuilderArtifactSchema.parse(parsed) as unknown as BuilderArtifact;
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: "VALIDATION_FAILED",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "Schema validation failed",
    });
  }

  // Update cache with new entry
  const newEntry: ArtifactCacheEntry = {
    artifact: validated,
    contentHash,
    schemaHash: options.schemaHash,
    mtimeMs: stats.mtime.getTime(),
  };
  artifactCache.set(cacheKey, newEntry);

  return ok(validated);
};

/**
 * Invalidate artifact cache for a specific path or all paths.
 * Used for manual cache clearing and watch mode invalidation.
 *
 * @param path - Optional path to invalidate. If omitted, clears entire cache.
 */
export const invalidateArtifactCache = (path?: string): void => {
  if (path) {
    const resolvedPath = resolve(path);
    // Remove all entries for this path (across different schema hashes)
    const keysToDelete: string[] = [];
    for (const key of artifactCache.keys()) {
      if (key.startsWith(`${resolvedPath}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      artifactCache.delete(key);
    }
  } else {
    artifactCache.clear();
  }
};

/**
 * Get artifact cache statistics for debugging and monitoring.
 * Useful for validating cache hit rates in watch mode.
 *
 * @returns Cache statistics including size and entry details
 */
export const getArtifactCacheStats = (): {
  size: number;
  entries: Array<{ path: string; schemaHash: string | undefined; mtimeMs: number }>;
} => {
  const entries: Array<{ path: string; schemaHash: string | undefined; mtimeMs: number }> = [];

  for (const [key, entry] of artifactCache.entries()) {
    const [path, schemaHash] = key.split(":");
    entries.push({
      path,
      schemaHash: schemaHash === "default" ? undefined : schemaHash,
      mtimeMs: entry.mtimeMs,
    });
  }

  return {
    size: artifactCache.size,
    entries,
  };
};

export const resolveCanonicalId = (filename: string, astPath: string): CanonicalId =>
  createCanonicalId(resolve(filename), astPath);

export const lookupArtifact = (artifact: BuilderArtifact, canonicalId: string): BuilderArtifactElement | undefined => {
  return artifact.elements[canonicalId as CanonicalId];
};
