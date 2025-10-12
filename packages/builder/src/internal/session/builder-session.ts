import { dirname, join, normalize, resolve } from "node:path";
import { createContext } from "node:vm";
import { cachedFn } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { clearPseudoModuleRegistry, createPseudoModuleRegistry, getPseudoModuleRegistry } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "../../artifact";
import type { BuilderArtifact } from "../../artifact/types";
import { getAstAnalyzer } from "../../ast";
import { createJsonCache } from "../../cache/json-cache";
import { validateModuleDependencies } from "../../dependency-graph/builder";
import { createDiscoveryCache } from "../../discovery";
import { discoverModules } from "../../discovery/discoverer";
import { resolveEntryPaths } from "../../discovery/entry-paths";
import { invalidateFingerprint } from "../../discovery/fingerprint";
import type { DiscoverySnapshot } from "../../discovery/types";
import { builderErrors } from "../../errors";
import type { BuilderError } from "../../types";
import { buildIntermediateModules, type IntermediateModule } from "../intermediate-module";
import type { BuilderChangeSet } from "./change-set";
import { coercePaths } from "./change-set";

/**
 * Session state maintained across incremental builds.
 */
type SessionState = {
  /** Entry paths from last build */
  entrypoints: Set<string>;
  /** Discovery snapshots keyed by normalized file path */
  snapshots: Map<string, DiscoverySnapshot>;
  /** Module-level adjacency: file -> files that import it */
  moduleAdjacency: Map<string, Set<string>>;
  /** Written intermediate modules: filePath -> intermediate module */
  intermediateModules: Map<string, IntermediateModule>;
  /** Last successful artifact */
  lastArtifact: BuilderArtifact | null;
};

/**
 * Session snapshot for debugging and monitoring.
 */
export type BuilderSessionSnapshot = {
  readonly snapshotCount: number;
  readonly moduleAdjacencySize: number;
};

/**
 * Builder session interface for incremental builds.
 */
export interface BuilderSession {
  /**
   * Update the entry points.
   */
  updateEntrypoints(input: { toAdd: readonly string[]; toRemove: readonly string[] }): void;

  /**
   * Perform initial full build from entry points.
   */
  buildInitial(): Promise<Result<BuilderArtifact, BuilderError>>;

  /**
   * Perform incremental update based on file changes.
   */
  update(changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>>;

  /**
   * Get current session state snapshot.
   */
  getSnapshot(): BuilderSessionSnapshot;
}

/**
 * Resolve a module specifier to an absolute file path for runtime imports.
 * Uses hybrid resolution: tries in-memory graph first, falls back to filesystem.
 * Returns null for external (node_modules) or bare specifiers.
 *
 * @internal testing
 */
const resolveModuleSpecifierRuntime = async (
  source: string,
  fromFilePath: string,
  snapshots: Map<string, DiscoverySnapshot>,
): Promise<string | null> => {
  // Skip external imports (bare specifiers)
  if (!source.startsWith(".")) {
    return null;
  }

  // Try to find in existing graph first (fast path)
  const fromDir = dirname(fromFilePath);
  const resolved = resolve(fromDir, source);
  const normalized = normalize(resolved);

  // Check common candidates in the graph
  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    join(normalized, "index.ts"),
    join(normalized, "index.tsx"),
    join(normalized, "index.js"),
    join(normalized, "index.jsx"),
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate).replace(/\\/g, "/");
    if (snapshots.has(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  // Fallback: use filesystem resolution (handles .tsx and index.tsx that might not be in graph)
  const { resolveModuleSpecifierFS } = await import("../../dependency-graph/resolver");
  return resolveModuleSpecifierFS(fromFilePath, source);
};

/**
 * Extract module-level adjacency from dependency graph.
 * Returns Map of file path -> set of files that import it.
 *
 * @internal testing
 */
const extractModuleAdjacency = async (snapshots: Map<string, DiscoverySnapshot>): Promise<Map<string, Set<string>>> => {
  // Phase 2: Build importer -> [imported paths] map from dependencies
  const importsByModule = new Map<string, Set<string>>();

  for (const snapshot of snapshots.values()) {
    const { filePath, dependencies, analysis } = snapshot;
    const imports = new Set<string>();

    // Extract module paths from canonical IDs in dependencies
    for (const { resolvedPath } of dependencies) {
      if (resolvedPath && resolvedPath !== filePath && snapshots.has(resolvedPath)) {
        imports.add(resolvedPath);
      }
    }

    // Phase 3: Handle runtime imports for modules with no tracked dependencies
    if (dependencies.length === 0 && analysis.imports.length > 0) {
      for (const imp of analysis.imports) {
        if (imp.isTypeOnly) {
          continue;
        }

        const resolved = await resolveModuleSpecifierRuntime(imp.source, filePath, snapshots);
        if (resolved) {
          imports.add(resolved);
        }
      }
    }

    if (imports.size > 0) {
      importsByModule.set(filePath, imports);
    }
  }

  // Phase 4: Invert to adjacency map (imported -> [importers])
  const adjacency = new Map<string, Set<string>>();

  for (const [importer, imports] of importsByModule) {
    for (const imported of imports) {
      if (!adjacency.has(imported)) {
        adjacency.set(imported, new Set());
      }
      adjacency.get(imported)?.add(importer);
    }
  }

  // Include all modules, even isolated ones with no importers
  for (const modulePath of snapshots.keys()) {
    if (!adjacency.has(modulePath)) {
      adjacency.set(modulePath, new Set());
    }
  }

  return adjacency;
};

/**
 * Collect all modules affected by changes, including transitive dependents.
 * Uses BFS to traverse module adjacency graph.
 */
const collectAffectedModules = (changedFiles: Set<string>, moduleAdjacency: Map<string, Set<string>>): Set<string> => {
  const affected = new Set<string>(changedFiles);
  const queue = [...changedFiles];
  const visited = new Set<string>(changedFiles);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const dependents = moduleAdjacency.get(current);

    if (dependents) {
      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }
  }

  return affected;
};

/**
 * Exported internal helpers for testing purposes.
 *
 * @internal testing
 */
export const __internal = {
  extractModuleAdjacency,
  resolveModuleSpecifierRuntime,
  collectAffectedModules,
};

/**
 * Create a new builder session.
 *
 * The session maintains in-memory state across builds to enable incremental processing.
 * Call buildInitial() first, then use update() for subsequent changes.
 */
export const createBuilderSession = (options: {
  readonly evaluatorId?: string;
  readonly config: ResolvedSodaGqlConfig;
}): BuilderSession => {
  const config = options.config;
  const evaluatorId = options.evaluatorId ?? "default";

  // Session state stored in closure
  const state: SessionState = {
    entrypoints: new Set(),
    snapshots: new Map(),
    moduleAdjacency: new Map(),
    intermediateModules: new Map(),
    lastArtifact: null,
  };

  // Reusable discovery infrastructure
  const cacheFactory = createJsonCache({
    rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
    prefix: ["builder"],
  });

  const ensureDiscoveryCache = cachedFn(() =>
    createDiscoveryCache({
      factory: cacheFactory,
      analyzer: config.builder.analyzer,
      evaluatorId,
    }),
  );

  const ensureAstAnalyzer = cachedFn(() => getAstAnalyzer(config.builder.analyzer));

  const updateEntrypoints = (input: { toAdd: readonly string[]; toRemove: readonly string[] }) => {
    for (const entry of input.toAdd) {
      state.entrypoints.add(entry);
    }
    for (const entry of input.toRemove) {
      state.entrypoints.delete(entry);
    }
  };

  const evaluate = async ({ intermediateModules }: { intermediateModules: Map<string, IntermediateModule> }) => {
    // Determine import paths from config
    const registry = createPseudoModuleRegistry();
    const gqlImportPath = resolve(process.cwd(), config.graphqlSystemPath);

    const vmContext = createContext({
      ...(await import(gqlImportPath)),
      registry,
    });

    for (const { script, filePath } of intermediateModules.values()) {
      try {
        script.runInContext(vmContext);
      } catch (error) {
        console.error(`Error evaluating intermediate module ${filePath}:`, error);
        throw error;
      }
    }

    const elements = registry.evaluate();
    registry.clear();

    return elements;
  };

  const buildInitial = async (): Promise<Result<BuilderArtifact, BuilderError>> => {
    // Clear registry for clean slate
    clearPseudoModuleRegistry(evaluatorId);

    const discoveryCache = ensureDiscoveryCache();
    const astAnalyzer = ensureAstAnalyzer();

    // Resolve entry paths
    const entryPathsResult = resolveEntryPaths(Array.from(state.entrypoints));
    if (entryPathsResult.isErr()) {
      return err(entryPathsResult.error);
    }

    // Run discovery
    const discoveryResult = discoverModules({
      entryPaths: entryPathsResult.value,
      astAnalyzer,
      cache: discoveryCache,
      analyzer: config.builder.analyzer,
    });
    if (discoveryResult.isErr()) {
      return err(discoveryResult.error);
    }
    const { snapshots, cacheHits, cacheMisses, cacheSkips } = discoveryResult.value;

    // Store discovery snapshots
    state.snapshots.clear();
    for (const snapshot of snapshots) {
      state.snapshots.set(snapshot.normalizedFilePath, snapshot);
    }

    // Build analyses from snapshots
    const analyses = new Map(snapshots.map((s) => [s.normalizedFilePath, s.analysis]));

    // Build dependency graph
    const dependenciesValidationResult = validateModuleDependencies({ analyses });
    if (dependenciesValidationResult.isErr()) {
      const graphError = dependenciesValidationResult.error;
      if (graphError.code === "MISSING_IMPORT") {
        return err(builderErrors.graphMissingImport(graphError.chain[0], graphError.chain[1]));
      }
      return err(builderErrors.graphCircularDependency(graphError.chain));
    }

    // Extract and store adjacency maps
    state.moduleAdjacency = await extractModuleAdjacency(state.snapshots);

    const intermediateModules = buildIntermediateModules({ analyses, targetPaths: new Set(analyses.keys()) });

    // Evaluate all intermediate modules
    const elements = await evaluate({ intermediateModules: intermediateModules });

    // Build artifact from all intermediate modules
    const artifactResult = await buildArtifact({
      analyses,
      elements,
      cache: { hits: cacheHits, misses: cacheMisses, skips: cacheSkips },
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    // Store artifact for no-change scenarios
    state.lastArtifact = artifactResult.value;
    state.intermediateModules = intermediateModules;

    return ok(artifactResult.value);
  };

  const update = async (changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>> => {
    // Clear registry for clean slate (avoids import cache issues)
    clearPseudoModuleRegistry(evaluatorId);

    const discoveryCache = ensureDiscoveryCache();
    const astAnalyzer = ensureAstAnalyzer();

    // Track changed and removed files using coercePaths helper
    const changedFiles = new Set<string>([...coercePaths(changeSet.added), ...coercePaths(changeSet.updated)]);
    const removedFiles = coercePaths(changeSet.removed);

    // Early return if no changes
    if (changedFiles.size === 0 && removedFiles.size === 0) {
      // No changes - return last artifact if available
      if (state.lastArtifact) {
        return ok(state.lastArtifact);
      }

      return err({
        code: "RUNTIME_MODULE_LOAD_FAILED",
        filePath: "",
        astPath: "",
        message: "No changes detected but no cached artifact available",
      });
    }

    // Clear discovery cache for removed files
    for (const filePath of removedFiles) {
      // state.snapshots.delete(filePath);
      discoveryCache.delete(filePath);
      invalidateFingerprint(filePath);
    }

    // 2. Collect all affected modules (changed + dependents from removed + transitive)
    const allChangedFiles = new Set([...changedFiles, ...removedFiles]);
    const affectedModules = collectAffectedModules(allChangedFiles, state.moduleAdjacency);

    // Resolve entry paths
    const entryPathsResult = resolveEntryPaths(Array.from(state.entrypoints));
    if (entryPathsResult.isErr()) {
      return err(entryPathsResult.error);
    }

    const entryPaths = entryPathsResult.value;

    // Pass changed files, removed files, AND removed dependents as invalidated paths
    const allAffectedFiles = new Set([...changedFiles, ...removedFiles, ...affectedModules]);

    // Run discovery with invalidations
    const discoveryResult = discoverModules({
      entryPaths,
      astAnalyzer,
      cache: discoveryCache,
      analyzer: config.builder.analyzer,
      invalidatedPaths: allAffectedFiles,
    });
    if (discoveryResult.isErr()) {
      return err(discoveryResult.error);
    }
    const { snapshots, cacheHits, cacheMisses, cacheSkips } = discoveryResult.value;

    // Store discovery snapshots
    state.snapshots.clear();
    for (const snapshot of snapshots) {
      state.snapshots.set(snapshot.normalizedFilePath, snapshot);
    }

    // Build analyses from snapshots
    const analyses = new Map(snapshots.map((s) => [s.normalizedFilePath, s.analysis]));

    const dependenciesValidationResult = validateModuleDependencies({ analyses });
    if (dependenciesValidationResult.isErr()) {
      const graphError = dependenciesValidationResult.error;
      if (graphError.code === "MISSING_IMPORT") {
        return err(builderErrors.graphMissingImport(graphError.chain[0], graphError.chain[1]));
      }
      return err(builderErrors.graphCircularDependency(graphError.chain));
    }

    // Update adjacency maps (full rebuild for now - could be optimized)
    state.moduleAdjacency = await extractModuleAdjacency(state.snapshots);

    // Create next intermediate modules map (copy current state)
    const intermediateModules = new Map(state.intermediateModules);

    // Remove deleted chunks from next map immediately
    for (const removedFilePath of removedFiles) {
      intermediateModules.delete(removedFilePath);
    }

    // Build and write affected chunks
    if (affectedModules.size > 0) {
      // Build intermediate modules for affected files
      const incrementalIntermediateModules = buildIntermediateModules({ analyses, targetPaths: allAffectedFiles });

      for (const [filePath, intermediateModule] of incrementalIntermediateModules.entries()) {
        intermediateModules.set(filePath, intermediateModule);
      }
    }

    const elements = await evaluate({ intermediateModules });

    // Build artifact from all chunks
    const artifactResult = await buildArtifact({
      analyses,
      elements,
      cache: { hits: cacheHits, misses: cacheMisses, skips: cacheSkips },
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    // Commit the chunk module changes now that loading succeeded
    state.intermediateModules = intermediateModules;

    // Store and return the artifact
    state.lastArtifact = artifactResult.value;
    return ok(artifactResult.value);
  };

  const getSnapshot = (): BuilderSessionSnapshot => ({
    snapshotCount: state.snapshots.size,
    moduleAdjacencySize: state.moduleAdjacency.size,
  });

  return {
    updateEntrypoints,
    buildInitial,
    update,
    getSnapshot,
  };
};
