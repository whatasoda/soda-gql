import { dirname, join, normalize, resolve } from "node:path";

import { clearPseudoModuleRegistry } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "../../artifact";
import type { BuilderArtifact } from "../../artifact/types";
import { getAstAnalyzer } from "../../ast";
import { createJsonCache } from "../../cache/json-cache";
import type { CanonicalId } from "../../canonical-id/canonical-id";
import { buildDependencyGraph } from "../../dependency-graph";
import { diffDependencyGraphs } from "../../dependency-graph/differ";
import { applyGraphPatch, buildGraphIndex, type GraphIndex } from "../../dependency-graph/patcher";
import type { DependencyGraph } from "../../dependency-graph/types";
import { createDiscoveryCache } from "../../discovery";
import { discoverModules } from "../../discovery/discoverer";
import { resolveEntryPaths } from "../../discovery/entry-paths";
import { invalidateFingerprint } from "../../discovery/fingerprint";
import type { DiscoverySnapshot } from "../../discovery/types";
import { builderErrors } from "../../errors";
import type { BuilderError, BuilderInput } from "../../types";
import { createIntermediateModuleChunks } from "../intermediate-module";
import { type WrittenChunkModule, writeChunkModules } from "../intermediate-module/chunk-writer";
import { type ChunkManifest, diffChunkManifests, planChunks } from "../intermediate-module/chunks";
import { resolveCoreImportPath, resolveGqlImportPath } from "../intermediate-module/gql-import";
import { buildChunkModules } from "../intermediate-module/per-chunk-emission";
import type { BuilderChangeSet } from "./change-set";
import { coercePaths } from "./change-set";

/**
 * Session state maintained across incremental builds.
 */
type SessionState = {
  /** Discovery snapshots keyed by normalized file path */
  snapshots: Map<string, DiscoverySnapshot>;
  /** Full dependency graph from last build */
  graph: DependencyGraph;
  /** Graph index: file path -> set of canonical IDs */
  graphIndex: GraphIndex;
  /** Module-level adjacency: file -> files that import it */
  moduleAdjacency: Map<string, Set<string>>;
  /** Definition-level adjacency: canonical ID -> IDs that depend on it */
  definitionAdjacency: Map<CanonicalId, Set<CanonicalId>>;
  /** Chunk manifest from last build */
  chunkManifest: ChunkManifest | null;
  /** Written chunk modules: chunkId -> transpiled path */
  chunkModules: Map<string, WrittenChunkModule>;
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
 * Resolve a module specifier to an absolute file path for runtime imports.
 * Uses hybrid resolution: tries in-memory graph first, falls back to filesystem.
 * Returns null for external (node_modules) or bare specifiers.
 *
 * @internal testing
 */
const resolveModuleSpecifierRuntime = async (
  source: string,
  fromFilePath: string,
  modulesByPath: Map<string, DependencyGraph extends Map<unknown, infer V> ? V : never>,
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
    if (modulesByPath.has(normalizedCandidate)) {
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
const extractModuleAdjacency = async (graph: DependencyGraph): Promise<Map<string, Set<string>>> => {
  // Phase 1: Build per-module view
  const modulesByPath = new Map<string, DependencyGraph extends Map<unknown, infer V> ? V : never>();
  for (const node of graph.values()) {
    modulesByPath.set(node.filePath, node);
  }

  // Phase 2: Build importer -> [imported paths] map from dependencies
  const importsByModule = new Map<string, Set<string>>();

  for (const node of graph.values()) {
    const { filePath, dependencies, moduleSummary } = node;
    const imports = new Set<string>();

    // Extract module paths from canonical IDs in dependencies
    for (const depId of dependencies) {
      const [modulePath] = depId.split("::");
      if (modulePath && modulePath !== filePath && modulesByPath.has(modulePath)) {
        imports.add(modulePath);
      }
    }

    // Phase 3: Handle runtime imports for modules with no tracked dependencies
    if (dependencies.length === 0 && moduleSummary.runtimeImports.length > 0) {
      for (const runtimeImport of moduleSummary.runtimeImports) {
        const resolved = await resolveModuleSpecifierRuntime(runtimeImport.source, filePath, modulesByPath);
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
  for (const modulePath of modulesByPath.keys()) {
    if (!adjacency.has(modulePath)) {
      adjacency.set(modulePath, new Set());
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
 * Validate that all dependencies in the graph exist.
 * Returns an error if any node references a missing dependency.
 */
const validateGraphDependencies = (graph: DependencyGraph): Result<void, BuilderError> => {
  for (const node of graph.values()) {
    for (const depId of node.dependencies) {
      if (!graph.has(depId)) {
        // Extract file path from canonical ID (format: "path/to/file.ts::exportName")
        const [depFilePath = ""] = depId.split("::");

        return err(builderErrors.graphCircularDependency([node.filePath, depFilePath]));
      }
    }
  }
  return ok(undefined);
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
        // Extract file path from canonical ID (format: "path/to/file.ts::exportName")
        const parts = dependentId.split("::");
        const filePath = parts[0];
        if (filePath && filePath.length > 0) {
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
 * Exported internal helpers for testing purposes.
 *
 * @internal testing
 */
export const __internal = {
  extractModuleAdjacency,
  extractDefinitionAdjacency,
  resolveModuleSpecifierRuntime,
  metadataMatches,
  collectAffectedModules,
  dropRemovedFiles,
};

/**
 * Create a new builder session.
 *
 * The session maintains in-memory state across builds to enable incremental processing.
 * Call buildInitial() first, then use update() for subsequent changes.
 */
export const createBuilderSession = (options: { readonly evaluatorId?: string } = {}): BuilderSession => {
  const evaluatorId = options.evaluatorId ?? "default";

  // Session state stored in closure
  const state: SessionState = {
    snapshots: new Map(),
    graph: new Map(),
    graphIndex: new Map(),
    moduleAdjacency: new Map(),
    definitionAdjacency: new Map(),
    chunkManifest: null,
    chunkModules: new Map(),
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
    // Clear registry for clean slate
    clearPseudoModuleRegistry(evaluatorId);

    // Create or reuse discovery infrastructure
    if (!discoveryCache) {
      discoveryCache = createDiscoveryCache({
        factory: cacheFactory,
        analyzer: input.analyzer,
        evaluatorId,
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

    // Compute metadata for snapshots
    const snapshotMetadata = {
      schemaHash: input.schemaHash,
      analyzerVersion: input.analyzer,
    };

    // Run discovery
    const discoveryResult = discoverModules({
      entryPaths,
      astAnalyzer,
      cache: discoveryCache,
      metadata: snapshotMetadata,
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
    const analyses = snapshots.map((s) => s.analysis);

    // Build dependency graph
    const dependencyGraph = buildDependencyGraph(analyses);
    if (dependencyGraph.isErr()) {
      const graphError = dependencyGraph.error;
      if (graphError.code === "MISSING_IMPORT") {
        return err({
          code: "RUNTIME_MODULE_LOAD_FAILED",
          filePath: graphError.chain[0] || "",
          astPath: "",
          message: `Cannot resolve import '${graphError.chain[1]}' from '${graphError.chain[0]}'. The imported file may have been deleted or moved.`,
        });
      }
      return err(builderErrors.graphCircularDependency(graphError.chain as readonly string[]));
    }

    const graph = dependencyGraph.value;

    // Store graph and build index
    state.graph = graph;
    state.graphIndex = buildGraphIndex(graph);

    // Extract and store adjacency maps
    state.moduleAdjacency = await extractModuleAdjacency(graph);
    state.definitionAdjacency = extractDefinitionAdjacency(graph);

    // Store metadata
    state.metadata = snapshotMetadata;

    // Store input for fallback rebuilds
    state.lastInput = input;

    // Create intermediate module chunks
    const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");

    // Plan chunks and persist manifest
    const manifest = planChunks(graph, state.graphIndex, runtimeDir);
    state.chunkManifest = manifest;

    const chunksResult = await createIntermediateModuleChunks({
      graph,
      graphIndex: state.graphIndex,
      config: input.config,
      outDir: runtimeDir,
      evaluatorId,
    });

    if (chunksResult.isErr()) {
      return err(chunksResult.error);
    }

    // Store written chunks and extract statistics
    const { written: writtenChunks, skipped: chunksSkipped } = chunksResult.value;
    state.chunkModules = writtenChunks;

    // Build chunk paths map for artifact builder
    const chunkPaths = new Map<string, string>();
    for (const [chunkId, chunk] of writtenChunks.entries()) {
      chunkPaths.set(chunkId, chunk.transpiledPath);
    }

    // Build artifact from all chunks
    const artifactResult = await buildArtifact({
      graph,
      cache: { hits: cacheHits, misses: cacheMisses, skips: cacheSkips },
      chunks: { written: writtenChunks.size, skipped: chunksSkipped },
      intermediateModulePaths: chunkPaths,
      evaluatorId,
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    // Store artifact for no-change scenarios
    state.lastArtifact = artifactResult.value;

    return ok(artifactResult.value);
  };

  const update = async (changeSet: BuilderChangeSet): Promise<Result<BuilderArtifact, BuilderError>> => {
    // Clear registry for clean slate (avoids import cache issues)
    clearPseudoModuleRegistry(evaluatorId);

    // Validate metadata - fall back to full rebuild if mismatch
    if (!metadataMatches(changeSet.metadata, state.metadata)) {
      // Purge removed files from caches before rebuild
      for (const removedPath of changeSet.removed) {
        if (discoveryCache) {
          discoveryCache.delete(removedPath);
        }
        invalidateFingerprint(removedPath);
        state.snapshots.delete(removedPath);
      }

      // Clear state and rebuild
      state.snapshots.clear();
      state.graph.clear();
      state.graphIndex.clear();
      state.moduleAdjacency.clear();
      state.definitionAdjacency.clear();
      state.chunkManifest = null;
      state.chunkModules.clear();
      state.metadata = {
        schemaHash: "",
        analyzerVersion: "",
      };

      // Fall back to buildInitial
      if (!state.lastInput) {
        return err({
          code: "RUNTIME_MODULE_LOAD_FAILED",
          filePath: "",
          astPath: "",
          message: "Metadata mismatch but no previous input available for rebuild",
        });
      }

      // Sanitize entry paths by filtering out removed files
      const normalizedRemoved = new Set(coercePaths(changeSet.removed));
      const sanitizedEntry = state.lastInput.entry.filter((path) => !normalizedRemoved.has(path));
      state.lastInput = {
        ...state.lastInput,
        entry: sanitizedEntry,
      };

      return buildInitial(state.lastInput);
    }

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

    // 1. Drop removed files and collect their dependents
    const removedAffected = dropRemovedFiles(removedFiles, state);

    // Clear discovery cache for removed files
    for (const path of removedFiles) {
      discoveryCache?.delete(path);
      invalidateFingerprint(path);
    }

    // 2. Collect all affected modules (changed + dependents from removed + transitive)
    const allChangedFiles = new Set([...changedFiles, ...removedAffected]);
    const _affectedModules = collectAffectedModules(allChangedFiles, state.moduleAdjacency);

    // Strategy 3: True incremental rebuild with graph patches and chunk updates
    if (!state.lastInput) {
      return err({
        code: "RUNTIME_MODULE_LOAD_FAILED",
        filePath: "",
        astPath: "",
        message: "Cannot perform incremental update without previous input",
      });
    }

    // Create or reuse discovery infrastructure
    if (!discoveryCache) {
      discoveryCache = createDiscoveryCache({
        factory: cacheFactory,
        analyzer: state.lastInput.analyzer,
        evaluatorId,
      });
    }

    if (!astAnalyzer) {
      astAnalyzer = getAstAnalyzer(state.lastInput.analyzer);
    }

    // Guard: ensure state.lastInput and config are available
    if (!state.lastInput || !state.lastInput.config) {
      return err({
        code: "RUNTIME_MODULE_LOAD_FAILED",
        filePath: "",
        astPath: "",
        message: "Missing lastInput or config for incremental rebuild",
      });
    }

    // Resolve entry paths
    const entryPathsResult = resolveEntryPaths(state.lastInput.entry);
    if (entryPathsResult.isErr()) {
      return err(entryPathsResult.error);
    }

    const entryPaths = entryPathsResult.value;

    // Pass changed files, removed files, AND removed dependents as invalidated paths
    const invalidatedPaths = new Set([...changedFiles, ...removedFiles, ...removedAffected]);

    // Run discovery with invalidations
    const discoveryResult = discoverModules({
      entryPaths,
      astAnalyzer,
      cache: discoveryCache,
      metadata: state.metadata,
      invalidatedPaths,
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
    const analyses = snapshots.map((s) => s.analysis);

    // Build NEW dependency graph from fresh discovery
    const dependencyGraph = buildDependencyGraph(analyses);
    if (dependencyGraph.isErr()) {
      const graphError = dependencyGraph.error;
      if (graphError.code === "MISSING_IMPORT") {
        return err({
          code: "RUNTIME_MODULE_LOAD_FAILED",
          filePath: graphError.chain[0] || "",
          astPath: "",
          message: `Cannot resolve import '${graphError.chain[1]}' from '${graphError.chain[0]}'. The imported file may have been deleted or moved.`,
        });
      }
      return err(builderErrors.graphCircularDependency(graphError.chain as readonly string[]));
    }

    const newGraph = dependencyGraph.value;

    // Diff graphs to compute patch
    const graphPatch = diffDependencyGraphs(state.graph, newGraph);

    // Apply patch to existing graph
    applyGraphPatch(state.graph, state.graphIndex, graphPatch);

    // Validate that all dependencies are satisfied after patching
    const validationResult = validateGraphDependencies(state.graph);
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    // Update adjacency maps (full rebuild for now - could be optimized)
    state.moduleAdjacency = await extractModuleAdjacency(state.graph);
    state.definitionAdjacency = extractDefinitionAdjacency(state.graph);

    // Plan chunks from updated graph
    const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
    const newManifest = planChunks(state.graph, state.graphIndex, runtimeDir);

    // Diff chunk manifests to find changed chunks
    const chunkDiff = state.chunkManifest
      ? diffChunkManifests(state.chunkManifest, newManifest)
      : { added: newManifest.chunks, updated: new Map(), removed: new Set<string>() };

    // Persist new manifest
    state.chunkManifest = newManifest;

    // Create next chunk modules map (copy current state)
    const nextChunkModules = new Map(state.chunkModules);

    // Remove deleted chunks from next map immediately
    for (const removedChunkId of chunkDiff.removed) {
      nextChunkModules.delete(removedChunkId as string);
    }

    // Build and write affected chunks
    const affectedChunkIds = new Set([...chunkDiff.added.keys(), ...chunkDiff.updated.keys()]);

    // Track chunk write statistics
    let chunksWritten = 0;
    let chunksSkipped = 0;

    if (affectedChunkIds.size > 0) {
      // Get import paths from config
      const gqlImportPath = resolveGqlImportPath({ config: state.lastInput.config, outDir: runtimeDir });
      const coreImportPath = resolveCoreImportPath({ config: state.lastInput.config, outDir: runtimeDir });

      // Build chunk modules for affected files
      const allChunks = buildChunkModules({
        graph: state.graph,
        graphIndex: state.graphIndex,
        outDir: runtimeDir,
        gqlImportPath,
        coreImportPath,
        evaluatorId,
      });

      // Filter to only affected chunks
      const affectedChunks = new Map();
      for (const [chunkId, chunk] of allChunks.entries()) {
        if (affectedChunkIds.has(chunkId)) {
          affectedChunks.set(chunkId, chunk);
        }
      }

      // Write affected chunks to disk
      const writeResult = await writeChunkModules({ chunks: affectedChunks, outDir: runtimeDir });
      if (writeResult.isErr()) {
        return err(writeResult.error);
      }

      // Update next map with freshly written chunks
      const { written, skipped } = writeResult.value;
      for (const [chunkId, writtenChunk] of written.entries()) {
        nextChunkModules.set(chunkId, writtenChunk);
      }

      // Track chunk write statistics
      chunksWritten = written.size;
      chunksSkipped = skipped;
    }

    // Build chunk paths map from NEXT chunk modules (includes fresh chunks, excludes removed)
    const allChunkPaths = new Map<string, string>();
    for (const [chunkId, chunk] of nextChunkModules.entries()) {
      allChunkPaths.set(chunkId, chunk.transpiledPath);
    }

    // Build artifact from all chunks
    const artifactResult = await buildArtifact({
      graph: state.graph,
      cache: { hits: cacheHits, misses: cacheMisses, skips: cacheSkips },
      chunks: { written: chunksWritten, skipped: chunksSkipped },
      intermediateModulePaths: allChunkPaths,
      evaluatorId,
    });

    if (artifactResult.isErr()) {
      return err(artifactResult.error);
    }

    // Commit the chunk module changes now that loading succeeded
    state.chunkModules = nextChunkModules;

    // Store and return the artifact
    state.lastArtifact = artifactResult.value;
    return ok(artifactResult.value);
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
