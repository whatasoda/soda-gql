import { readFileSync } from "node:fs";
import type { getAstAnalyzer } from "../ast";
import { createCanonicalId } from "../registry";
import { normalizeToPosix } from "../utils/path-utils";
import { createSourceHash, extractModuleDependencies } from "./common";
import type { DiscoveryCache, DiscoverySnapshot, DiscoverySnapshotDefinition } from "./types";

export type DiscoverModulesOptions = {
  readonly entryPaths: readonly string[];
  readonly astAnalyzer: ReturnType<typeof getAstAnalyzer>;
  readonly cache?: DiscoveryCache;
};

export type DiscoverModulesResult = {
  readonly snapshots: readonly DiscoverySnapshot[];
  readonly cacheHits: number;
  readonly cacheMisses: number;
};

/**
 * Discover and analyze all modules starting from entry points.
 * Uses AST parsing instead of RegExp for reliable dependency extraction.
 * Supports caching to skip re-parsing unchanged files.
 */
export const discoverModules = ({ entryPaths, astAnalyzer, cache }: DiscoverModulesOptions): DiscoverModulesResult => {
  const snapshots = new Map<string, DiscoverySnapshot>();
  const stack = [...entryPaths];
  let cacheHits = 0;
  let cacheMisses = 0;

  while (stack.length > 0) {
    const filePath = stack.pop();
    if (!filePath || snapshots.has(filePath)) {
      continue;
    }

    // Read source and compute signature
    const source = readFileSync(filePath, "utf8");
    const signature = createSourceHash(source);

    // Check cache first
    if (cache) {
      const cached = cache.load(filePath, signature);
      if (cached) {
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
    }

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

    // Create snapshot
    const snapshot: DiscoverySnapshot = {
      filePath,
      normalizedFilePath: normalizeToPosix(filePath),
      analyzer: astAnalyzer.type,
      signature,
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
  };
};
