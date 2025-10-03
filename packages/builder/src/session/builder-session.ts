import { join } from "node:path";

import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "../artifact";
import type { BuilderArtifact } from "../artifact/types";
import { getAstAnalyzer } from "../ast";
import { createJsonCache } from "../cache/json-cache";
import type { CanonicalId } from "../canonical-id/canonical-id";
import { buildDependencyGraph } from "../dependency-graph";
import type { DependencyGraph } from "../dependency-graph/types";
import { createDiscoveryCache } from "../discovery";
import { discoverModules } from "../discovery/discoverer";
import { resolveEntryPaths } from "../discovery/entry-paths";
import type { DiscoverySnapshot } from "../discovery/types";
import { createIntermediateModule } from "../intermediate-module";
import type { BuilderError, BuilderInput } from "../types";
import type { BuilderChangeSet } from "./change-set";

/**
 * Session state maintained across incremental builds.
 */
type SessionState = {
  /** Discovery snapshots keyed by normalized file path */
  snapshots: Map<string, DiscoverySnapshot>;
  /** Module-level adjacency: file -> files that import it */
  moduleAdjacency: Map<string, Set<string>>;
  /** Definition-level adjacency: canonical ID -> IDs that depend on it */
  definitionAdjacency: Map<CanonicalId, Set<CanonicalId>>;
  /** Metadata for invalidation checks */
  metadata: {
    schemaHash: string;
    analyzerVersion: string;
  };
};

/**
 * Session snapshot for debugging and monitoring.
 */
export type BuilderSessionSnapshot = {
  readonly snapshotCount: number;
  readonly moduleAdjacencySize: number;
  readonly definitionAdjacencySize: number;
  readonly metadata: {
    readonly schemaHash: string;
    readonly analyzerVersion: string;
  };
};

/**
 * Builder session interface for incremental builds.
 */
export interface BuilderSession {
  /**
   * Perform initial full build from entry points.
   */
  buildInitial(input: BuilderInput): Promise<Result<BuilderArtifact, BuilderError>>;

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
 */
const extractModuleAdjacency = (graph: DependencyGraph): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.values()) {
    const { filePath, moduleSummary } = node;

    // For each import in this module, record that filePath imports the target
    for (const runtimeImport of moduleSummary.runtimeImports) {
      // Note: runtimeImport.source is the imported module path
      // We need to resolve it to absolute path, but for now we'll skip external imports
      // and only track internal module relationships through the graph
      const importedModules = Array.from(graph.values())
        .filter((n) => n.moduleSummary.gqlExports.length > 0)
        .map((n) => n.filePath);

      for (const importedPath of importedModules) {
        if (!adjacency.has(importedPath)) {
          adjacency.set(importedPath, new Set());
        }
        adjacency.get(importedPath)?.add(filePath);
      }
    }
  }

  return adjacency;
};

/**
 * Extract definition-level adjacency from dependency graph.
 * Returns Map of canonical ID -> set of IDs that depend on it.
 */
const extractDefinitionAdjacency = (graph: DependencyGraph): Map<CanonicalId, Set<CanonicalId>> => {
  const adjacency = new Map<CanonicalId, Set<CanonicalId>>();

  for (const node of graph.values()) {
    const { id, dependencies } = node;

    for (const depId of dependencies) {
      if (!adjacency.has(depId)) {
        adjacency.set(depId, new Set());
      }
      adjacency.get(depId)?.add(id);
    }
  }

  return adjacency;
};

/**
 * Create a new builder session.
 *
 * The session maintains in-memory state across builds to enable incremental processing.
 * Call buildInitial() first, then use update() for subsequent changes.
 */
export const createBuilderSession = (): BuilderSession => {
  // Session state stored in closure
  const state: SessionState = {
    snapshots: new Map(),
    moduleAdjacency: new Map(),
    definitionAdjacency: new Map(),
    metadata: {
      schemaHash: "",
      analyzerVersion: "",
    },
  };

  // Reusable discovery infrastructure
  const cacheFactory = createJsonCache({
    rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
    prefix: ["builder"],
  });

  let discoveryCache: ReturnType<typeof createDiscoveryCache> | null = null;
  let astAnalyzer: ReturnType<typeof getAstAnalyzer> | null = null;

  const buildInitial = async (input: BuilderInput): Promise<Result<BuilderArtifact, BuilderError>> => {
    // Create or reuse discovery infrastructure
    if (!discoveryCache) {
      discoveryCache = createDiscoveryCache({
        factory: cacheFactory,
        analyzer: input.analyzer,
        evaluatorId: "default",
      });
    }

    if (!astAnalyzer) {
      astAnalyzer = getAstAnalyzer(input.analyzer);
    }

    // Resolve entry paths
    const entryPathsResult = resolveEntryPaths(input.entry);
    if (entryPathsResult.isErr()) {
      return err(entryPathsResult.error);
    }

    const entryPaths = entryPathsResult.value;

    // Run discovery
    const { snapshots, cacheHits, cacheMisses } = discoverModules({
      entryPaths,
      astAnalyzer,
      cache: discoveryCache,
    });

    // Store discovery snapshots
    state.snapshots.clear();
    for (const snapshot of snapshots) {
      state.snapshots.set(snapshot.normalizedFilePath, snapshot);
    }

    // Build analyses from snapshots
    const analyses = snapshots.map((s) => s.analysis);

    // Build dependency graph
    const dependencyGraph = buildDependencyGraph(analyses);
    if (dependencyGraph.isErr()) {
      return err({
        code: "CIRCULAR_DEPENDENCY",
        chain: dependencyGraph.error.chain,
      });
    }

    const graph = dependencyGraph.value;

    // Extract and store adjacency maps
    state.moduleAdjacency = extractModuleAdjacency(graph);
    state.definitionAdjacency = extractDefinitionAdjacency(graph);

    // Store metadata (use placeholder for now, will be enhanced)
    state.metadata = {
      schemaHash: "", // TODO: Compute from schema file
      analyzerVersion: input.analyzer,
    };

    // Create intermediate module
    const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
    const intermediateModule = await createIntermediateModule({
      graph,
      outDir: runtimeDir,
    });

    if (intermediateModule.isErr()) {
      return err(intermediateModule.error);
    }

    const { transpiledPath } = intermediateModule.value;

    // Build artifact
    const artifactResult = await buildArtifact({
      graph,
      cache: { hits: cacheHits, misses: cacheMisses },
      intermediateModulePath: transpiledPath,
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    return ok(artifactResult.value);
  };

  const update = async (changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>> => {
    // TODO: Implement incremental update
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: "",
      astPath: "",
      message: "update not implemented",
    });
  };

  const getSnapshot = (): BuilderSessionSnapshot => {
    return {
      snapshotCount: state.snapshots.size,
      moduleAdjacencySize: state.moduleAdjacency.size,
      definitionAdjacencySize: state.definitionAdjacency.size,
      metadata: {
        schemaHash: state.metadata.schemaHash,
        analyzerVersion: state.metadata.analyzerVersion,
      },
    };
  };

  return {
    buildInitial,
    update,
    getSnapshot,
  };
};
