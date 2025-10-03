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
  /** Last build input for fallback rebuilds */
  lastInput: BuilderInput | null;
  /** Last successful artifact */
  lastArtifact: BuilderArtifact | null;
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
 * Validate if metadata matches between change set and session.
 */
const metadataMatches = (changeSetMeta: BuilderChangeSet["metadata"], sessionMeta: SessionState["metadata"]): boolean => {
  return changeSetMeta.schemaHash === sessionMeta.schemaHash && changeSetMeta.analyzerVersion === sessionMeta.analyzerVersion;
};

/**
 * Extract module-level adjacency from dependency graph.
 * Returns Map of file path -> set of files that import it.
 */
const extractModuleAdjacency = (graph: DependencyGraph): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.values()) {
    const { filePath, moduleSummary } = node;

    // For each import in this module, record that filePath imports the target
    for (const _runtimeImport of moduleSummary.runtimeImports) {
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
 * Collect all definitions affected by removed files.
 */
const collectAffectedDefinitions = (removedFiles: Set<string>, snapshots: Map<string, DiscoverySnapshot>): Set<CanonicalId> => {
  const affectedDefinitions = new Set<CanonicalId>();

  for (const filePath of removedFiles) {
    const snapshot = snapshots.get(filePath);
    if (snapshot) {
      for (const def of snapshot.definitions) {
        affectedDefinitions.add(def.canonicalId);
      }
    }
  }

  return affectedDefinitions;
};

/**
 * Remove files from session state and return affected modules.
 */
const dropRemovedFiles = (removedFiles: Set<string>, state: SessionState): Set<string> => {
  const affectedModules = new Set<string>();

  // Collect affected definitions before removing snapshots
  const affectedDefinitions = collectAffectedDefinitions(removedFiles, state.snapshots);

  // Remove from snapshots
  for (const filePath of removedFiles) {
    state.snapshots.delete(filePath);
  }

  // Find modules that depend on removed definitions
  for (const defId of affectedDefinitions) {
    const dependents = state.definitionAdjacency.get(defId);
    if (dependents) {
      for (const dependentId of dependents) {
        // Extract file path from canonical ID (format: "file:path#exportName")
        const filePath = dependentId.split("#")[0]?.replace("file:", "");
        if (filePath) {
          affectedModules.add(filePath);
        }
      }
    }
    // Remove from adjacency
    state.definitionAdjacency.delete(defId);
  }

  // Remove from module adjacency
  for (const filePath of removedFiles) {
    state.moduleAdjacency.delete(filePath);

    // Remove from other modules' dependent sets
    for (const [, dependents] of state.moduleAdjacency) {
      dependents.delete(filePath);
    }
  }

  return affectedModules;
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
    lastInput: null,
    lastArtifact: null,
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

    // Store metadata
    // For V1: Use analyzer as schema hash (simple but functional)
    // Future: Hash actual GraphQL schema file content
    state.metadata = {
      schemaHash: input.analyzer, // Using analyzer as proxy for schema version in V1
      analyzerVersion: input.analyzer,
    };

    // Store input for fallback rebuilds
    state.lastInput = input;

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

    // Store artifact for no-change scenarios
    state.lastArtifact = artifactResult.value;

    return ok(artifactResult.value);
  };

  const update = async (changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>> => {
    // Validate metadata - fall back to full rebuild if mismatch
    if (!metadataMatches(changeSet.metadata, state.metadata)) {
      // Clear state and rebuild
      state.snapshots.clear();
      state.moduleAdjacency.clear();
      state.definitionAdjacency.clear();
      state.metadata = {
        schemaHash: "",
        analyzerVersion: "",
      };

      // Fall back to buildInitial
      if (!state.lastInput) {
        return err({
          code: "MODULE_EVALUATION_FAILED",
          filePath: "",
          astPath: "",
          message: "Metadata mismatch but no previous input available for rebuild",
        });
      }

      return buildInitial(state.lastInput);
    }

    // Track changed and removed files
    const changedFiles = new Set<string>([
      ...changeSet.added.map((f) => f.filePath),
      ...changeSet.updated.map((f) => f.filePath),
    ]);
    const removedFiles = new Set<string>(changeSet.removed);

    // Early return if no changes
    if (changedFiles.size === 0 && removedFiles.size === 0) {
      // No changes - return last artifact if available
      if (state.lastArtifact) {
        return ok(state.lastArtifact);
      }

      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: "",
        astPath: "",
        message: "No changes detected but no cached artifact available",
      });
    }

    // 1. Drop removed files and collect their dependents
    const removedAffected = dropRemovedFiles(removedFiles, state);

    // 2. Collect all affected modules (changed + dependents from removed + transitive)
    const allChangedFiles = new Set([...changedFiles, ...removedAffected]);
    const _affectedModules = collectAffectedModules(allChangedFiles, state.moduleAdjacency);

    // For simplicity in v1: Just do a full rebuild when there are changes
    // This maintains correctness while we build out incremental logic
    if (!state.lastInput) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: "",
        astPath: "",
        message: "Cannot perform incremental update without previous input",
      });
    }

    // TODO: Implement true incremental discovery and graph merging
    // For now, fall back to full rebuild to maintain correctness
    return buildInitial(state.lastInput);
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
