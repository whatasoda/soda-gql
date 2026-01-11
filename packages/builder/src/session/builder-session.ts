import { join, resolve } from "node:path";
import { cachedFn, createAsyncScheduler, createSyncScheduler, type EffectGenerator, type SchedulerError } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { type BuilderArtifact, buildArtifact } from "../artifact";
import { createAstAnalyzer, type ModuleAnalysis } from "../ast";
import { type CacheFactory, createMemoryCache } from "../cache/memory-cache";
import {
  createDiscoveryCache,
  type DiscoveryCache,
  type DiscoverySnapshot,
  discoverModulesGen,
  type ModuleLoadStats,
  resolveEntryPaths,
} from "../discovery";
import { builderErrors } from "../errors";
import {
  evaluateIntermediateModulesGen,
  generateIntermediateModules,
  type IntermediateArtifactElement,
  type IntermediateModule,
} from "../intermediate-module";
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createFileTracker, type FileDiff, type FileScan, isEmptyDiff } from "../tracker";
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
  /** Last successful intermediate elements (for prebuilt type generation) */
  lastIntermediateElements: Record<string, IntermediateArtifactElement> | null;
};

/**
 * Input for the unified build generator.
 */
type BuildGenInput = {
  readonly entryPaths: readonly string[];
  readonly astAnalyzer: ReturnType<typeof createAstAnalyzer>;
  readonly discoveryCache: DiscoveryCache;
  readonly changedFiles: Set<string>;
  readonly removedFiles: Set<string>;
  readonly previousModuleAdjacency: Map<string, Set<string>>;
  readonly previousIntermediateModules: ReadonlyMap<string, IntermediateModule>;
  readonly graphqlSystemPath: string;
  readonly graphqlHelper: ReturnType<typeof createGraphqlSystemIdentifyHelper>;
};

/**
 * Result from the unified build generator.
 */
type BuildGenResult = {
  readonly snapshots: Map<string, DiscoverySnapshot>;
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly currentModuleAdjacency: Map<string, Set<string>>;
  readonly intermediateModules: Map<string, IntermediateModule>;
  readonly elements: Record<string, IntermediateArtifactElement>;
  readonly stats: ModuleLoadStats;
};

/**
 * Builder session interface for incremental builds.
 */
export interface BuilderSession {
  /**
   * Perform build fully or incrementally (synchronous).
   * The session automatically detects file changes using the file tracker.
   * Throws if any element requires async operations (e.g., async metadata factory).
   */
  build(options?: { force?: boolean }): Result<BuilderArtifact, BuilderError>;
  /**
   * Perform build fully or incrementally (asynchronous).
   * The session automatically detects file changes using the file tracker.
   * Supports async metadata factories and parallel element evaluation.
   */
  buildAsync(options?: { force?: boolean }): Promise<Result<BuilderArtifact, BuilderError>>;
  /**
   * Get the current generation number.
   */
  getGeneration(): number;
  /**
   * Get the current artifact.
   */
  getCurrentArtifact(): BuilderArtifact | null;
  /**
   * Get the intermediate elements from the most recent build.
   * Returns null if no build has been performed yet.
   * Used by typegen to extract field selections for prebuilt type generation.
   */
  getIntermediateElements(): Record<string, IntermediateArtifactElement> | null;
  /**
   * Dispose the session and save cache to disk.
   */
  dispose(): void;
}

/**
 * Singleton state for beforeExit handler registration.
 * Ensures only one handler is registered regardless of how many sessions are created.
 */
const exitHandlerState = {
  registered: false,
  factories: new Set<CacheFactory>(),
};

/**
 * Register a cache factory for save on process exit.
 * Uses singleton pattern to prevent multiple handler registrations.
 */
const registerExitHandler = (cacheFactory: CacheFactory): void => {
  exitHandlerState.factories.add(cacheFactory);

  if (!exitHandlerState.registered) {
    exitHandlerState.registered = true;
    process.on("beforeExit", () => {
      // Save all registered cache factories sequentially
      for (const factory of exitHandlerState.factories) {
        factory.save();
      }
    });
  }
};

/**
 * Unregister a cache factory from the exit handler.
 */
const unregisterExitHandler = (cacheFactory: CacheFactory): void => {
  exitHandlerState.factories.delete(cacheFactory);
};

/**
 * Reset exit handler state for testing.
 * @internal
 */
export const __resetExitHandlerForTests = (): void => {
  exitHandlerState.registered = false;
  exitHandlerState.factories.clear();
};

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
  const entrypoints: ReadonlySet<string> = new Set(options.entrypointsOverride ?? config.include);

  // Session state stored in closure
  const state: SessionState = {
    gen: 0,
    snapshots: new Map(),
    moduleAdjacency: new Map(),
    intermediateModules: new Map(),
    lastArtifact: null,
    lastIntermediateElements: null,
  };

  // Reusable infrastructure
  const cacheFactory = createMemoryCache({
    prefix: ["builder"],
    persistence: {
      enabled: true,
      filePath: join(process.cwd(), "node_modules", ".cache", "soda-gql", "builder", "cache.json"),
    },
  });

  // Register for auto-save on process exit using singleton handler
  registerExitHandler(cacheFactory);

  const graphqlHelper = createGraphqlSystemIdentifyHelper(config);
  const ensureAstAnalyzer = cachedFn(() =>
    createAstAnalyzer({
      analyzer: config.analyzer,
      graphqlHelper,
    }),
  );
  const ensureDiscoveryCache = cachedFn(() =>
    createDiscoveryCache({
      factory: cacheFactory,
      analyzer: config.analyzer,
      evaluatorId,
    }),
  );
  const ensureFileTracker = cachedFn(() => createFileTracker());

  /**
   * Prepare build input. Shared between sync and async builds.
   * Returns either a skip result or the input for buildGen.
   */
  const prepareBuildInput = (
    force: boolean,
  ): Result<
    { type: "skip"; artifact: BuilderArtifact } | { type: "build"; input: BuildGenInput; currentScan: FileScan },
    BuilderError
  > => {
    // 1. Resolve entry paths (with exclude patterns)
    const entryPathsResult = resolveEntryPaths(Array.from(entrypoints), config.exclude);
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

    // 4. Prepare for build
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
      return ok({ type: "skip", artifact: prepareResult.value.data.artifact });
    }

    const { changedFiles, removedFiles } = prepareResult.value.data;

    return ok({
      type: "build",
      input: {
        entryPaths,
        astAnalyzer: ensureAstAnalyzer(),
        discoveryCache: ensureDiscoveryCache(),
        changedFiles,
        removedFiles,
        previousModuleAdjacency: state.moduleAdjacency,
        previousIntermediateModules: state.intermediateModules,
        graphqlSystemPath: resolve(config.outdir, "index.ts"),
        graphqlHelper,
      },
      currentScan,
    });
  };

  /**
   * Finalize build and update session state.
   */
  const finalizeBuild = (genResult: BuildGenResult, currentScan: FileScan): Result<BuilderArtifact, BuilderError> => {
    const { snapshots, analyses, currentModuleAdjacency, intermediateModules, elements, stats } = genResult;

    // Build artifact from all intermediate modules
    const artifactResult = buildArtifact({
      analyses,
      elements,
      stats,
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    // Update session state
    state.gen++;
    state.snapshots = snapshots;
    state.moduleAdjacency = currentModuleAdjacency;
    state.lastArtifact = artifactResult.value;
    state.intermediateModules = intermediateModules;
    state.lastIntermediateElements = elements;

    // Persist tracker state (soft failure - don't block on cache write)
    ensureFileTracker().update(currentScan);

    return ok(artifactResult.value);
  };

  /**
   * Synchronous build using SyncScheduler.
   * Throws if any element requires async operations.
   */
  const build = (options?: { force?: boolean }): Result<BuilderArtifact, BuilderError> => {
    const prepResult = prepareBuildInput(options?.force ?? false);
    if (prepResult.isErr()) {
      return err(prepResult.error);
    }

    if (prepResult.value.type === "skip") {
      return ok(prepResult.value.artifact);
    }

    const { input, currentScan } = prepResult.value;
    const scheduler = createSyncScheduler();

    try {
      const result = scheduler.run(() => buildGen(input));

      if (result.isErr()) {
        return err(convertSchedulerError(result.error));
      }

      return finalizeBuild(result.value, currentScan);
    } catch (error) {
      // Handle thrown BuilderError from buildGen
      if (error && typeof error === "object" && "code" in error) {
        return err(error as BuilderError);
      }
      throw error;
    }
  };

  /**
   * Asynchronous build using AsyncScheduler.
   * Supports async metadata factories and parallel element evaluation.
   */
  const buildAsync = async (options?: { force?: boolean }): Promise<Result<BuilderArtifact, BuilderError>> => {
    const prepResult = prepareBuildInput(options?.force ?? false);
    if (prepResult.isErr()) {
      return err(prepResult.error);
    }

    if (prepResult.value.type === "skip") {
      return ok(prepResult.value.artifact);
    }

    const { input, currentScan } = prepResult.value;
    const scheduler = createAsyncScheduler();

    try {
      const result = await scheduler.run(() => buildGen(input));

      if (result.isErr()) {
        return err(convertSchedulerError(result.error));
      }

      return finalizeBuild(result.value, currentScan);
    } catch (error) {
      // Handle thrown BuilderError from buildGen
      if (error && typeof error === "object" && "code" in error) {
        return err(error as BuilderError);
      }
      throw error;
    }
  };

  return {
    build,
    buildAsync,
    getGeneration: () => state.gen,
    getCurrentArtifact: () => state.lastArtifact,
    getIntermediateElements: () => state.lastIntermediateElements,
    dispose: () => {
      cacheFactory.save();
      // Unregister from exit handler to prevent duplicate saves
      unregisterExitHandler(cacheFactory);
    },
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

/**
 * Unified build generator that yields effects for file I/O and element evaluation.
 * This enables single scheduler control at the root level for both sync and async execution.
 */
function* buildGen(input: BuildGenInput): EffectGenerator<BuildGenResult> {
  const {
    entryPaths,
    astAnalyzer,
    discoveryCache,
    changedFiles,
    removedFiles,
    previousModuleAdjacency,
    previousIntermediateModules,
    graphqlSystemPath,
    graphqlHelper,
  } = input;

  // Phase 1: Collect affected files
  const affectedFiles = collectAffectedFiles({
    changedFiles,
    removedFiles,
    previousModuleAdjacency,
  });

  // Phase 2: Discovery (yields file I/O effects)
  const discoveryResult = yield* discoverModulesGen({
    entryPaths,
    astAnalyzer,
    incremental: {
      cache: discoveryCache,
      changedFiles,
      removedFiles,
      affectedFiles,
    },
  });

  const { cacheHits, cacheMisses, cacheSkips } = discoveryResult;

  const snapshots = new Map(discoveryResult.snapshots.map((snapshot) => [snapshot.normalizedFilePath, snapshot]));
  const analyses = new Map(discoveryResult.snapshots.map((snapshot) => [snapshot.normalizedFilePath, snapshot.analysis]));

  // Phase 3: Validate module dependencies (pure computation)
  const dependenciesValidationResult = validateModuleDependencies({ analyses, graphqlSystemHelper: graphqlHelper });
  if (dependenciesValidationResult.isErr()) {
    const error = dependenciesValidationResult.error;
    throw builderErrors.graphMissingImport(error.chain[0], error.chain[1]);
  }

  const currentModuleAdjacency = extractModuleAdjacency({ snapshots });

  const stats: ModuleLoadStats = {
    hits: cacheHits,
    misses: cacheMisses,
    skips: cacheSkips,
  };

  // Phase 4: Generate intermediate modules (pure computation)
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
  for (const intermediateModule of generateIntermediateModules({ analyses, targetFiles, graphqlSystemPath })) {
    intermediateModules.set(intermediateModule.filePath, intermediateModule);
  }

  // Phase 5: Evaluate intermediate modules (yields element evaluation effects)
  const elements = yield* evaluateIntermediateModulesGen({ intermediateModules, graphqlSystemPath, analyses });

  return {
    snapshots,
    analyses,
    currentModuleAdjacency,
    intermediateModules,
    elements,
    stats,
  };
}

/**
 * Convert scheduler error to builder error.
 * If the cause is already a BuilderError, return it directly to preserve error codes.
 */
const convertSchedulerError = (error: SchedulerError): BuilderError => {
  // If the cause is a BuilderError, return it directly
  if (error.cause && typeof error.cause === "object" && "code" in error.cause) {
    return error.cause as BuilderError;
  }
  return builderErrors.internalInvariant(error.message, "scheduler", error.cause);
};
