import { readFileSync, statSync } from "node:fs";
import { normalizePath } from "@soda-gql/common";
import { err, ok } from "neverthrow";
import type { createAstAnalyzer } from "../ast";
import { type BuilderResult, builderErrors } from "../errors";
import { createSourceHash, extractModuleDependencies } from "./common";
import { computeFingerprint, invalidateFingerprint } from "./fingerprint";
import type { DiscoveryCache, DiscoverySnapshot } from "./types";

export type DiscoverModulesOptions = {
  readonly entryPaths: readonly string[];
  readonly astAnalyzer: ReturnType<typeof createAstAnalyzer>;
  /** Set of file paths explicitly invalidated (from BuilderChangeSet) */
  readonly incremental?: {
    readonly cache: DiscoveryCache;
    readonly changedFiles: Set<string>;
    readonly removedFiles: Set<string>;
    readonly affectedFiles: Set<string>;
  };
};

export type DiscoverModulesResult = {
  readonly snapshots: readonly DiscoverySnapshot[];
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheSkips: number;
};

/**
 * Discover and analyze all modules starting from entry points.
 * Uses AST parsing instead of RegExp for reliable dependency extraction.
 * Supports caching with fingerprint-based invalidation to skip re-parsing unchanged files.
 */
export const discoverModules = ({
  entryPaths,
  astAnalyzer,
  incremental,
}: DiscoverModulesOptions): BuilderResult<DiscoverModulesResult> => {
  const snapshots = new Map<string, DiscoverySnapshot>();
  const stack = [...entryPaths];
  const changedFiles = incremental?.changedFiles ?? new Set<string>();
  const removedFiles = incremental?.removedFiles ?? new Set<string>();
  const affectedFiles = incremental?.affectedFiles ?? new Set<string>();
  const invalidatedSet = new Set<string>([...changedFiles, ...removedFiles, ...affectedFiles]);
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheSkips = 0;

  if (incremental) {
    for (const filePath of removedFiles) {
      incremental.cache.delete(filePath);
      invalidateFingerprint(filePath);
    }
  }

  while (stack.length > 0) {
    const rawFilePath = stack.pop();
    if (!rawFilePath) {
      continue;
    }

    // Normalize path for consistent cache key matching
    const filePath = normalizePath(rawFilePath);

    if (snapshots.has(filePath)) {
      continue;
    }

    // Check if explicitly invalidated
    if (invalidatedSet.has(filePath)) {
      invalidateFingerprint(filePath);
      cacheSkips++;
      // Fall through to re-read and re-parse
    } else if (incremental) {
      // Try fingerprint-based cache check (avoid reading file)
      const cached = incremental.cache.peek(filePath);

      if (cached) {
        try {
          // Fast path: check fingerprint without reading file content
          const stats = statSync(filePath);
          const mtimeMs = stats.mtimeMs;
          const sizeBytes = stats.size;

          // If fingerprint matches, reuse cached snapshot
          if (cached.fingerprint.mtimeMs === mtimeMs && cached.fingerprint.sizeBytes === sizeBytes) {
            snapshots.set(filePath, cached);
            cacheHits++;
            // Enqueue dependencies from cache
            for (const dep of cached.dependencies) {
              if (dep.resolvedPath && !snapshots.has(dep.resolvedPath)) {
                stack.push(dep.resolvedPath);
              }
            }
            continue;
          }
        } catch {
          // File may have been deleted or inaccessible, fall through to re-read
        }
      }
    }

    // Read source and compute signature
    let source: string;
    try {
      source = readFileSync(filePath, "utf8");
    } catch (error) {
      // Handle deleted files gracefully - they may be in cache but removed from disk
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Delete from cache and invalidate fingerprint
        incremental?.cache.delete(filePath);
        invalidateFingerprint(filePath);
        continue;
      }
      // Return other IO errors
      return err(builderErrors.discoveryIOError(filePath, error instanceof Error ? error.message : String(error)));
    }
    const signature = createSourceHash(source);

    // Parse module
    const analysis = astAnalyzer.analyze({ filePath, source });
    cacheMisses++;

    // Build dependency records (relative + external) in a single pass
    const dependencies = extractModuleDependencies(analysis);

    // Enqueue all resolved relative dependencies for traversal
    for (const dep of dependencies) {
      if (!dep.isExternal && dep.resolvedPath && !snapshots.has(dep.resolvedPath)) {
        stack.push(dep.resolvedPath);
      }
    }

    // Compute fingerprint
    const fingerprintResult = computeFingerprint(filePath);
    if (fingerprintResult.isErr()) {
      return err(builderErrors.discoveryIOError(filePath, `Failed to compute fingerprint: ${fingerprintResult.error.message}`));
    }
    const fingerprint = fingerprintResult.value;

    // Create snapshot
    const snapshot: DiscoverySnapshot = {
      filePath,
      normalizedFilePath: normalizePath(filePath),
      signature,
      fingerprint,
      analyzer: astAnalyzer.type,
      createdAtMs: Date.now(),
      analysis,
      dependencies,
    };

    snapshots.set(filePath, snapshot);

    // Store in cache
    if (incremental) {
      incremental.cache.store(snapshot);
    }
  }

  return ok({
    snapshots: Array.from(snapshots.values()),
    cacheHits,
    cacheMisses,
    cacheSkips,
  });
};
