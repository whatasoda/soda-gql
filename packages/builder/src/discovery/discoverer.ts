import { createAsyncScheduler, createSyncScheduler, type EffectGenerator, normalizePath } from "@soda-gql/common";
import { err, ok } from "neverthrow";
import { extname } from "node:path";
import type { createAstAnalyzer } from "../ast";
import type { ModuleAnalysis } from "../ast/types";
import { type BuilderResult, builderErrors } from "../errors";
import { type FileStats, OptionalFileReadEffect, OptionalFileStatEffect } from "../scheduler";
import { createSourceHash, extractModuleDependencies } from "./common";
import { computeFingerprintFromContent, invalidateFingerprint } from "./fingerprint";
import type { DiscoveryCache, DiscoverySnapshot } from "./types";

/**
 * JavaScript file extensions that should be treated as empty modules.
 * These files are included in the dependency graph but not parsed for definitions.
 */
const JS_FILE_EXTENSIONS = [".js", ".mjs", ".cjs", ".jsx"] as const;

/**
 * Check if a file path is a JavaScript file (not TypeScript).
 * Used to skip AST analysis for JS files that are resolved as fallbacks.
 */
const isJsFile = (filePath: string): boolean => {
  const ext = extname(filePath).toLowerCase();
  return (JS_FILE_EXTENSIONS as readonly string[]).includes(ext);
};

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
 * Generator-based module discovery that yields effects for file I/O.
 * This allows the discovery process to be executed with either sync or async schedulers.
 */
export function* discoverModulesGen({
  entryPaths,
  astAnalyzer,
  incremental,
}: DiscoverModulesOptions): EffectGenerator<DiscoverModulesResult> {
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
    let shouldReadFile = true;
    if (invalidatedSet.has(filePath)) {
      invalidateFingerprint(filePath);
      cacheSkips++;
      // Fall through to re-read and re-parse
    } else if (incremental) {
      // Try fingerprint-based cache check (avoid reading file)
      const cached = incremental.cache.peek(filePath);

      if (cached) {
        // Fast path: check fingerprint without reading file content
        const stats = yield* new OptionalFileStatEffect(filePath).run();

        if (stats) {
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
            shouldReadFile = false;
          }
        }
        // If stats is null (file deleted), fall through to read attempt
      }
    }

    if (!shouldReadFile) {
      continue;
    }

    // Read source and compute signature
    const source = yield* new OptionalFileReadEffect(filePath).run();

    if (source === null) {
      // Handle deleted files gracefully - they may be in cache but removed from disk
      incremental?.cache.delete(filePath);
      invalidateFingerprint(filePath);
      continue;
    }

    const signature = createSourceHash(source);

    // Parse module (skip AST analysis for JS files - treat as empty)
    let analysis: ModuleAnalysis;
    if (isJsFile(filePath)) {
      // JS files are included in the dependency graph but treated as empty modules.
      // This happens when a .js import specifier resolves to an actual .js file
      // because no corresponding .ts file exists.
      analysis = {
        filePath,
        signature,
        definitions: [],
        imports: [],
        exports: [],
        diagnostics: [],
      };
    } else {
      analysis = astAnalyzer.analyze({ filePath, source });
    }
    cacheMisses++;

    // Build dependency records (relative + external) in a single pass
    const dependencies = extractModuleDependencies(analysis);

    // Enqueue all resolved relative dependencies for traversal
    for (const dep of dependencies) {
      if (!dep.isExternal && dep.resolvedPath && !snapshots.has(dep.resolvedPath)) {
        stack.push(dep.resolvedPath);
      }
    }

    // Get stats for fingerprint (we may already have them from cache check)
    const stats = (yield* new OptionalFileStatEffect(filePath).run()) as FileStats;

    // Compute fingerprint from content (avoids re-reading the file)
    const fingerprint = computeFingerprintFromContent(filePath, stats, source);

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

  return {
    snapshots: Array.from(snapshots.values()),
    cacheHits,
    cacheMisses,
    cacheSkips,
  };
}

/**
 * Discover and analyze all modules starting from entry points.
 * Uses AST parsing instead of RegExp for reliable dependency extraction.
 * Supports caching with fingerprint-based invalidation to skip re-parsing unchanged files.
 *
 * This function uses the synchronous scheduler internally for backward compatibility.
 * For async execution with parallel file I/O, use discoverModulesGen with an async scheduler.
 */
export const discoverModules = (options: DiscoverModulesOptions): BuilderResult<DiscoverModulesResult> => {
  const scheduler = createSyncScheduler();
  const result = scheduler.run(() => discoverModulesGen(options));

  if (result.isErr()) {
    const error = result.error;
    // Convert scheduler error to builder error
    return err(builderErrors.discoveryIOError("unknown", error.message));
  }

  return ok(result.value);
};

/**
 * Asynchronous version of discoverModules.
 * Uses async scheduler for parallel file I/O operations.
 *
 * This is useful for large codebases where parallel file operations can improve performance.
 */
export const discoverModulesAsync = async (options: DiscoverModulesOptions): Promise<BuilderResult<DiscoverModulesResult>> => {
  const scheduler = createAsyncScheduler();
  const result = await scheduler.run(() => discoverModulesGen(options));

  if (result.isErr()) {
    const error = result.error;
    // Convert scheduler error to builder error
    return err(builderErrors.discoveryIOError("unknown", error.message));
  }

  return ok(result.value);
};
