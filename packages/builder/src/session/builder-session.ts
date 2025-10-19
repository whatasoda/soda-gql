import { join } from "node:path";
import { cachedFn } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { type BuilderArtifact, buildArtifact } from "../artifact";
import { getAstAnalyzer, type ModuleAnalysis } from "../ast";
import { createJsonCache } from "../cache/json-cache";
import {
  createDiscoveryCache,
  type DiscoveryCache,
  type DiscoverySnapshot,
  discoverModules,
  type ModuleLoadStats,
  resolveEntryPaths,
} from "../discovery";
import { builderErrors } from "../errors";
import { evaluateIntermediateModules, generateIntermediateModules, type IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";
import type { BuilderChangeSet } from "./change-set";
import { coercePaths } from "./change-set";
import { validateModuleDependencies } from "./dependency-validation";
import { collectAffectedFiles, extractModuleAdjacency } from "./module-adjacency";

/**
 * Session state maintained across incremental builds.
 */
type SessionState = {
  /** Generation number */
  gen: number;
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
 * Builder session interface for incremental builds.
 */
export interface BuilderSession {
  /**
   * Perform build fully or incrementally.
   */
  build(input: { changeSet: BuilderChangeSet | null }): Result<BuilderArtifact, BuilderError>;
  /**
   * Get the current generation number.
   */
  getGeneration(): number;
  /**
   * Get the current artifact.
   */
  getCurrentArtifact(): BuilderArtifact | null;
}

/**
 * Create a new builder session.
 *
 * The session maintains in-memory state across builds to enable incremental processing.
 */
export const createBuilderSession = (options: {
  readonly evaluatorId?: string;
  readonly entrypoints: readonly string[] | ReadonlySet<string>;
  readonly config: ResolvedSodaGqlConfig;
}): BuilderSession => {
  const config = options.config;
  const evaluatorId = options.evaluatorId ?? "default";
  const entrypoints: ReadonlySet<string> = new Set(options.entrypoints);

  // Session state stored in closure
  const state: SessionState = {
    gen: 0,
    snapshots: new Map(),
    moduleAdjacency: new Map(),
    intermediateModules: new Map(),
    lastArtifact: null,
  };

  // Reusable discovery infrastructure
  const ensureAstAnalyzer = cachedFn(() => getAstAnalyzer(config.builder.analyzer));
  const ensureDiscoveryCache = cachedFn(() =>
    createDiscoveryCache({
      factory: createJsonCache({
        rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
        prefix: ["builder"],
      }),
      analyzer: config.builder.analyzer,
      evaluatorId,
    }),
  );

  const build = ({ changeSet }: { changeSet: BuilderChangeSet | null }): Result<BuilderArtifact, BuilderError> => {
    const prepareResult = prepare({ entrypoints, changeSet, lastArtifact: state.lastArtifact });
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
      previousModuleAdjacency: state.moduleAdjacency,
    });
    if (discoveryResult.isErr()) {
      return err(discoveryResult.error);
    }

    const { snapshots, analyses, currentModuleAdjacency, affectedFiles, stats } = discoveryResult.value;

    const buildResult = buildDiscovered({
      analyses,
      affectedFiles,
      stats,
      previousIntermediateModules: state.intermediateModules,
      graphqlSystemPath: config.graphqlSystemPath,
    });
    if (buildResult.isErr()) {
      return err(buildResult.error);
    }

    const { intermediateModules, artifact } = buildResult.value;

    state.gen++;
    state.snapshots = snapshots;
    state.moduleAdjacency = currentModuleAdjacency;
    state.lastArtifact = artifact;
    state.intermediateModules = intermediateModules;

    return ok(artifact);
  };

  return {
    build,
    getGeneration: () => state.gen,
    getCurrentArtifact: () => state.lastArtifact,
  };
};

const prepare = (input: {
  entrypoints: ReadonlySet<string>;
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
  previousModuleAdjacency,
}: {
  discoveryCache: DiscoveryCache;
  astAnalyzer: ReturnType<typeof getAstAnalyzer>;
  removedFiles: Set<string>;
  changedFiles: Set<string>;
  entryPaths: readonly string[];
  previousModuleAdjacency: Map<string, Set<string>>;
}) => {
  // Collect all affected modules (changed + dependents from removed + transitive)
  const affectedFiles = collectAffectedFiles({
    changedFiles,
    removedFiles,
    previousModuleAdjacency,
  });

  // Run discovery with invalidations
  const discoveryResult = discoverModules({
    entryPaths,
    astAnalyzer,
    incremental: {
      cache: discoveryCache,
      changedFiles,
      removedFiles,
      affectedFiles,
    },
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

  const currentModuleAdjacency = extractModuleAdjacency({ snapshots });

  const stats: ModuleLoadStats = {
    hits: cacheHits,
    misses: cacheMisses,
    skips: cacheSkips,
  };

  return ok({ snapshots, analyses, currentModuleAdjacency, affectedFiles, stats });
};

const buildDiscovered = ({
  analyses,
  affectedFiles,
  stats,
  previousIntermediateModules,
  graphqlSystemPath,
}: {
  analyses: Map<string, ModuleAnalysis>;
  affectedFiles: Set<string>;
  stats: ModuleLoadStats;
  previousIntermediateModules: ReadonlyMap<string, IntermediateModule>;
  graphqlSystemPath: string;
}) => {
  // Create next intermediate modules map (copy current state)
  const intermediateModules = new Map(previousIntermediateModules);

  const targetFiles = affectedFiles.size > 0 ? affectedFiles : new Set(analyses.keys());

  // Remove deleted intermediate modules from next map immediately
  for (const targetFilePath of targetFiles) {
    intermediateModules.delete(targetFilePath);
  }

  // Build and write affected intermediate modules
  for (const intermediateModule of generateIntermediateModules({ analyses, targetFiles })) {
    intermediateModules.set(intermediateModule.filePath, intermediateModule);
  }

  const elements = evaluateIntermediateModules({ intermediateModules, graphqlSystemPath });

  // Build artifact from all intermediate modules
  const artifactResult = buildArtifact({
    analyses,
    elements,
    stats,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  return ok({ intermediateModules, artifact: artifactResult.value });
};
