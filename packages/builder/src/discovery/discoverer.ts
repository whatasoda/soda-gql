import { readFileSync, statSync } from "node:fs";
import type { getAstAnalyzer } from "../ast";
import { createCanonicalId } from "../canonical-id/canonical-id";
import { normalizeToPosix } from "../utils/path-utils";
import { createSourceHash, extractModuleDependencies } from "./common";
import { computeFingerprint, invalidateFingerprint } from "./fingerprint";
import type { DiscoveryCache, DiscoverySnapshot, DiscoverySnapshotDefinition, DiscoverySnapshotMetadata } from "./types";

export type DiscoverModulesOptions = {
  readonly entryPaths: readonly string[];
  readonly astAnalyzer: ReturnType<typeof getAstAnalyzer>;
  readonly cache?: DiscoveryCache;
  readonly metadata: DiscoverySnapshotMetadata;
  /** Set of file paths explicitly invalidated (from BuilderChangeSet) */
  readonly invalidatedPaths?: ReadonlySet<string>;
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
  cache,
  metadata,
  invalidatedPaths,
}: DiscoverModulesOptions): DiscoverModulesResult => {
  const snapshots = new Map<string, DiscoverySnapshot>();
  const stack = [...entryPaths];
  const invalidatedSet = invalidatedPaths ?? new Set<string>();
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheSkips = 0;

  while (stack.length > 0) {
    const filePath = stack.pop();
    if (!filePath || snapshots.has(filePath)) {
      continue;
    }

    // Check if explicitly invalidated
    if (invalidatedSet.has(filePath)) {
      invalidateFingerprint(filePath);
      cacheSkips++;
      // Fall through to re-read and re-parse
    } else if (cache) {
      // Try fingerprint-based cache check (avoid reading file)
      const cached = cache.peek(filePath);
      if (cached) {
        try {
          // Fast path: check mtime/size without reading file content
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
        cache?.delete(filePath);
        invalidateFingerprint(filePath);
        continue;
      }
      // Re-throw other IO errors
      throw error;
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

    // Create definitions with canonical IDs
    const definitions: DiscoverySnapshotDefinition[] = analysis.definitions.map((def) => ({
      ...def,
      canonicalId: createCanonicalId(filePath, def.astPath),
    }));

    // Compute fingerprint
    const fingerprintResult = computeFingerprint(filePath);
    if (fingerprintResult.isErr()) {
      throw new Error(`Failed to compute fingerprint for ${filePath}: ${fingerprintResult.error.message}`);
    }
    const fingerprint = fingerprintResult.value;

    // Create snapshot
    const snapshot: DiscoverySnapshot = {
      filePath,
      normalizedFilePath: normalizeToPosix(filePath),
      analyzer: astAnalyzer.type,
      signature,
      fingerprint,
      metadata,
      createdAtMs: Date.now(),
      analysis,
      definitions,
      dependencies,
      diagnostics: analysis.diagnostics,
      exports: analysis.exports,
      imports: analysis.imports,
    };

    snapshots.set(filePath, snapshot);

    // Store in cache
    if (cache) {
      cache.store(snapshot);
    }
  }

  return {
    snapshots: Array.from(snapshots.values()),
    cacheHits,
    cacheMisses,
    cacheSkips,
  };
};
