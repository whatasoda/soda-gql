import { dirname, join, normalize, resolve } from "node:path";
import { createContext } from "node:vm";
import { cachedFn, resolveRelativeImportWithReferences } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { clearPseudoModuleRegistry, createPseudoModuleRegistry, getPseudoModuleRegistry } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "../../artifact";
import type { BuilderArtifact } from "../../artifact/types";
import { getAstAnalyzer, type ModuleAnalysis } from "../../ast";
import { createJsonCache } from "../../cache/json-cache";
import { validateModuleDependencies } from "../../dependency-graph/builder";
import { createDiscoveryCache, type ModuleLoadStats } from "../../discovery";
import { discoverModules } from "../../discovery/discoverer";
import { resolveEntryPaths } from "../../discovery/entry-paths";
import { invalidateFingerprint } from "../../discovery/fingerprint";
import type { DiscoveryCache, DiscoverySnapshot } from "../../discovery/types";
import { builderErrors } from "../../errors";
import type { BuilderError } from "../../types";
import { evaluateIntermediateModules, generateIntermediateModules, type IntermediateModule } from "../intermediate-module";
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
 * Extract module-level adjacency from dependency graph.
 * Returns Map of file path -> set of files that import it.
 *
 * @internal testing
 */
const extractModuleAdjacency = (snapshots: Map<string, DiscoverySnapshot>): Map<string, Set<string>> => {
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

        const resolved = resolveRelativeImportWithReferences({ filePath, specifier: imp.source, references: snapshots });
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
const collectAffectedFiles = (changedFiles: Set<string>, moduleAdjacency: Map<string, Set<string>>): Set<string> => {
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
  collectAffectedFiles,
};

const prepare = (input: {
  entrypoints: Set<string>;
  readonly changeSet: BuilderChangeSet | null;
  lastArtifact: BuilderArtifact | null;
}) => {
  const changeSet = (input.lastArtifact ? input.changeSet : null) ?? { added: [], updated: [], removed: [] };

  const changedFiles = new Set<string>([...coercePaths(changeSet.added), ...coercePaths(changeSet.updated)]);
  const removedFiles = coercePaths(changeSet.removed);

  if (changedFiles.size === 0 && removedFiles.size === 0 && input.lastArtifact) {
    return ok({ type: "should-skip" as const, data: { artifact: input.lastArtifact } });
  }

  // Resolve entry paths
  const entryPathsResult = resolveEntryPaths(Array.from(input.entrypoints));
  if (entryPathsResult.isErr()) {
    return err(entryPathsResult.error);
  }

  const entryPaths = entryPathsResult.value;

  return ok({ type: "should-build" as const, data: { changedFiles, removedFiles, entryPaths } });
};

const discover = ({
  discoveryCache,
  astAnalyzer,
  removedFiles,
  changedFiles,
  entryPaths,
  currentModuleAdjacency,
}: {
  discoveryCache: DiscoveryCache;
  astAnalyzer: ReturnType<typeof getAstAnalyzer>;
  removedFiles: Set<string>;
  changedFiles: Set<string>;
  entryPaths: readonly string[];
  currentModuleAdjacency: Map<string, Set<string>>;
}) => {
  for (const filePath of removedFiles) {
    discoveryCache.delete(filePath);
    invalidateFingerprint(filePath);
  }

  // Collect all affected modules (changed + dependents from removed + transitive)
  const allChangedFiles = new Set([...changedFiles, ...removedFiles]);
  const affectedFiles = collectAffectedFiles(allChangedFiles, currentModuleAdjacency);

  // Pass changed files, removed files, AND removed dependents as invalidated paths
  const allAffectedFiles = new Set([...changedFiles, ...removedFiles, ...affectedFiles]);

  // Run discovery with invalidations
  const discoveryResult = discoverModules({
    entryPaths,
    astAnalyzer,
    cache: discoveryCache,
    invalidatedPaths: allAffectedFiles,
  });
  if (discoveryResult.isErr()) {
    return err(discoveryResult.error);
  }

  const { cacheHits, cacheMisses, cacheSkips } = discoveryResult.value;

  const snapshots = new Map(discoveryResult.value.snapshots.map((snapshot) => [snapshot.normalizedFilePath, snapshot]));
  const analyses = new Map(discoveryResult.value.snapshots.map((snapshot) => [snapshot.normalizedFilePath, snapshot.analysis]));

  const dependenciesValidationResult = validateModuleDependencies({ analyses });
  if (dependenciesValidationResult.isErr()) {
    const error = dependenciesValidationResult.error;
    return err(builderErrors.graphMissingImport(error.chain[0], error.chain[1]));
  }

  const moduleAdjacency = extractModuleAdjacency(snapshots);

  const stats: ModuleLoadStats = {
    hits: cacheHits,
    misses: cacheMisses,
    skips: cacheSkips,
  };

  return ok({ snapshots, analyses, moduleAdjacency, affectedFiles, stats });
};

const build = async ({
  analyses,
  affectedFiles,
  stats,
  currentIntermediateModules,
  graphqlSystemPath,
}: {
  analyses: Map<string, ModuleAnalysis>;
  affectedFiles: Set<string>;
  stats: ModuleLoadStats;
  currentIntermediateModules: Map<string, IntermediateModule>;
  graphqlSystemPath: string;
}) => {
  // Create next intermediate modules map (copy current state)
  const intermediateModules = new Map(currentIntermediateModules);

  const targetFilePaths = affectedFiles.size > 0 ? affectedFiles : new Set(analyses.keys());

  // Remove deleted chunks from next map immediately
  for (const targetFilePath of targetFilePaths) {
    intermediateModules.delete(targetFilePath);
  }

  // Build and write affected chunks
  for (const intermediateModule of generateIntermediateModules({ analyses, targetFilePaths })) {
    intermediateModules.set(intermediateModule.filePath, intermediateModule);
  }

  const elements = await evaluateIntermediateModules({ intermediateModules, graphqlSystemPath });

  // Build artifact from all chunks
  const artifactResult = await buildArtifact({
    analyses,
    elements,
    stats: stats,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  return ok({ intermediateModules, artifact: artifactResult.value });
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

  const buildInitial = async (): Promise<Result<BuilderArtifact, BuilderError>> => {
    const prepareResult = prepare({ entrypoints: state.entrypoints, changeSet: null, lastArtifact: null });
    if (prepareResult.isErr()) {
      return err(prepareResult.error);
    }

    if (prepareResult.value.type === "should-skip") {
      return ok(prepareResult.value.data.artifact);
    }

    const { changedFiles, removedFiles, entryPaths } = prepareResult.value.data;

    const discoveryCache = ensureDiscoveryCache();
    const astAnalyzer = ensureAstAnalyzer();

    const discoveryResult = discover({
      discoveryCache,
      astAnalyzer,
      removedFiles,
      changedFiles,
      entryPaths,
      currentModuleAdjacency: state.moduleAdjacency,
    });
    if (discoveryResult.isErr()) {
      return err(discoveryResult.error);
    }

    const { snapshots, analyses, affectedFiles, moduleAdjacency, stats } = discoveryResult.value;

    const buildResult = await build({
      analyses,
      affectedFiles,
      stats,
      currentIntermediateModules: state.intermediateModules,
      graphqlSystemPath: config.graphqlSystemPath,
    });
    if (buildResult.isErr()) {
      return err(buildResult.error);
    }

    const { intermediateModules, artifact } = buildResult.value;

    state.snapshots = snapshots;
    state.moduleAdjacency = moduleAdjacency;
    state.lastArtifact = artifact;
    state.intermediateModules = intermediateModules;

    return ok(artifact);
  };

  const update = async (changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>> => {
    const prepareResult = prepare({ entrypoints: state.entrypoints, changeSet, lastArtifact: state.lastArtifact });
    if (prepareResult.isErr()) {
      return err(prepareResult.error);
    }

    if (prepareResult.value.type === "should-skip") {
      return ok(prepareResult.value.data.artifact);
    }

    const { changedFiles, removedFiles, entryPaths } = prepareResult.value.data;
    const discoveryCache = ensureDiscoveryCache();
    const astAnalyzer = ensureAstAnalyzer();
    const discoveryResult = discover({
      discoveryCache,
      astAnalyzer,
      removedFiles,
      changedFiles,
      entryPaths,
      currentModuleAdjacency: state.moduleAdjacency,
    });
    if (discoveryResult.isErr()) {
      return err(discoveryResult.error);
    }

    const { snapshots, analyses, moduleAdjacency, affectedFiles, stats } = discoveryResult.value;

    const buildResult = await build({
      analyses,
      affectedFiles,
      stats,
      currentIntermediateModules: state.intermediateModules,
      graphqlSystemPath: config.graphqlSystemPath,
    });
    if (buildResult.isErr()) {
      return err(buildResult.error);
    }

    const { intermediateModules, artifact } = buildResult.value;

    state.snapshots = snapshots;
    state.moduleAdjacency = moduleAdjacency;
    state.lastArtifact = artifact;
    state.intermediateModules = intermediateModules;

    return ok(artifact);
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
