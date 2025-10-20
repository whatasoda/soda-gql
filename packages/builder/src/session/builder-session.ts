import { join } from "node:path";
import { cachedFn } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { type BuilderArtifact, buildArtifact } from "../artifact";
import { createAstAnalyzer, type ModuleAnalysis } from "../ast";
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
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createFileTracker, type FileDiff, isEmptyDiff } from "../tracker";
import type { BuilderError } from "../types";
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
   * The session automatically detects file changes using the file tracker.
   */
  build(options?: { force?: boolean }): Result<BuilderArtifact, BuilderError>;
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
  readonly entrypointsOverride?: readonly string[] | ReadonlySet<string>;
  readonly config: ResolvedSodaGqlConfig;
}): BuilderSession => {
  const config = options.config;
  const evaluatorId = options.evaluatorId ?? "default";
  const entrypoints: ReadonlySet<string> = new Set(options.entrypointsOverride ?? config.builder.entry);

  // Session state stored in closure
  const state: SessionState = {
    gen: 0,
    snapshots: new Map(),
    moduleAdjacency: new Map(),
    intermediateModules: new Map(),
    lastArtifact: null,
  };

  // Reusable infrastructure
  const cacheFactory = createJsonCache({
    rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
    prefix: ["builder"],
  });

  const graphqlHelper = createGraphqlSystemIdentifyHelper(config);
  const ensureAstAnalyzer = cachedFn(() =>
    createAstAnalyzer({
      analyzer: config.builder.analyzer,
      graphqlHelper,
    }),
  );
  const ensureDiscoveryCache = cachedFn(() =>
    createDiscoveryCache({
      factory: cacheFactory,
      analyzer: config.builder.analyzer,
      evaluatorId,
    }),
  );
  const ensureFileTracker = cachedFn(() => createFileTracker());

  const build = (options?: { force?: boolean }): Result<BuilderArtifact, BuilderError> => {
    const force = options?.force ?? false;

    // 1. Resolve entry paths
    const entryPathsResult = resolveEntryPaths(Array.from(entrypoints));
    if (entryPathsResult.isErr()) {
      return err(entryPathsResult.error);
    }
    const entryPaths = entryPathsResult.value;

    // 2. Load tracker and detect changes
    const tracker = ensureFileTracker();
    const scanResult = tracker.scan(entryPaths);
    if (scanResult.isErr()) {
      const trackerError = scanResult.error;
      return err(
        builderErrors.discoveryIOError(
          trackerError.type === "scan-failed" ? trackerError.path : "unknown",
          `Failed to scan files: ${trackerError.message}`,
        ),
      );
    }

    // 3. Scan current files (entry paths + previously tracked files)
    const currentScan = scanResult.value;
    const diff = tracker.detectChanges();

    // 5. Prepare for build
    const prepareResult = prepare({
      diff,
      entryPaths,
      lastArtifact: state.lastArtifact,
      force,
    });
    if (prepareResult.isErr()) {
      return err(prepareResult.error);
    }

    if (prepareResult.value.type === "should-skip") {
      return ok(prepareResult.value.data.artifact);
    }

    const { changedFiles, removedFiles } = prepareResult.value.data;

    // 6. Run discovery
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

    // 7. Build artifact
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

    // 8. Update session state
    state.gen++;
    state.snapshots = snapshots;
    state.moduleAdjacency = currentModuleAdjacency;
    state.lastArtifact = artifact;
    state.intermediateModules = intermediateModules;

    // 9. Persist tracker state (soft failure - don't block on cache write)
    tracker.update(currentScan);

    return ok(artifact);
  };

  return {
    build,
    getGeneration: () => state.gen,
    getCurrentArtifact: () => state.lastArtifact,
  };
};

const prepare = (input: {
  diff: FileDiff;
  entryPaths: readonly string[];
  lastArtifact: BuilderArtifact | null;
  force: boolean;
}) => {
  const { diff, lastArtifact, force } = input;

  // Convert diff to sets for discovery
  const changedFiles = new Set<string>([...diff.added, ...diff.updated]);
  const removedFiles = diff.removed;

  // Skip build only if:
  // 1. Not forced
  // 2. No changes detected
  // 3. Previous artifact exists
  if (!force && isEmptyDiff(diff) && lastArtifact) {
    return ok({ type: "should-skip" as const, data: { artifact: lastArtifact } });
  }

  return ok({ type: "should-build" as const, data: { changedFiles, removedFiles } });
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
  astAnalyzer: ReturnType<typeof createAstAnalyzer>;
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

  // Build target set: include affected files + any newly discovered files that haven't been built yet
  const targetFiles = new Set(affectedFiles);
  for (const filePath of analyses.keys()) {
    if (!previousIntermediateModules.has(filePath)) {
      targetFiles.add(filePath);
    }
  }
  // If no targets identified (e.g., first build with no changes), build everything
  if (targetFiles.size === 0) {
    for (const filePath of analyses.keys()) {
      targetFiles.add(filePath);
    }
  }

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
