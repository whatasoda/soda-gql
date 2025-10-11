import { createHash } from "node:crypto";
import type { CanonicalId } from "@soda-gql/common";
import type { DependencyGraph } from "../../dependency-graph";
import type { GraphIndex } from "../../dependency-graph/patcher";
import { groupNodesByFile } from "./analysis";

/** Unique identifier for a chunk (normalized source path) */
export type ChunkId = string;

/** Information about a single emitted chunk */
export type ChunkInfo = {
  /** Unique chunk identifier (normalized source path) */
  readonly id: ChunkId;
  /** Normalized source file path */
  readonly sourcePath: string;
  /** Absolute path of emitted chunk file */
  readonly outputPath: string;
  /** Content hash for cache busting */
  readonly contentHash: string;
  /** Canonical IDs of definitions provided by this chunk */
  readonly canonicalIds: readonly CanonicalId[];
  /** Other chunks this chunk imports from */
  readonly imports: readonly ChunkId[];
};

/** Chunk manifest for incremental builds */
export type ChunkManifest = {
  /** Map of chunk ID to chunk info */
  readonly chunks: Map<ChunkId, ChunkInfo>;
  /** Manifest version (bump when schema/analyzer changes) */
  readonly version: number;
};

/**
 * Compute content hash from canonical IDs and their dependencies.
 */
const computeChunkHash = (canonicalIds: readonly CanonicalId[], dependencies: readonly CanonicalId[]): string => {
  const hash = createHash("sha256");

  // Sort for deterministic hashing
  const sortedIds = [...canonicalIds].sort();
  const sortedDeps = [...dependencies].sort();

  hash.update(sortedIds.join(","));
  hash.update("|");
  hash.update(sortedDeps.join(","));

  return hash.digest("hex").slice(0, 16);
};

/**
 * Plan chunks from a dependency graph.
 * Groups nodes by file and produces chunk info with content hashes.
 */
export const planChunks = (graph: DependencyGraph, graphIndex: GraphIndex, outDir: string): ChunkManifest => {
  const fileGroups = groupNodesByFile(graph);
  const chunks = new Map<ChunkId, ChunkInfo>();

  for (const group of fileGroups) {
    const { filePath, nodes } = group;
    const canonicalIds = nodes.map((n) => n.id);

    // Collect all dependencies from nodes in this chunk
    const allDependencies = new Set<CanonicalId>();
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        allDependencies.add(dep);
      }
    }

    // Find which other chunks this chunk imports
    const imports = new Set<ChunkId>();
    for (const dep of allDependencies) {
      const [depFile] = dep.split("::");
      if (depFile && depFile !== filePath && graphIndex.has(depFile)) {
        imports.add(depFile);
      }
    }

    const contentHash = computeChunkHash(canonicalIds, Array.from(allDependencies));
    const outputPath = `${outDir}/chunks/${contentHash}.mjs`;

    chunks.set(filePath, {
      id: filePath,
      sourcePath: filePath,
      outputPath,
      contentHash,
      canonicalIds,
      imports: Array.from(imports).sort(),
    });
  }

  return {
    chunks,
    version: 1,
  };
};

/**
 * Diff two manifests to find added, updated, and removed chunks.
 */
export type ChunkDiff = {
  readonly added: Map<ChunkId, ChunkInfo>;
  readonly updated: Map<ChunkId, ChunkInfo>;
  readonly removed: Set<ChunkId>;
};

export const diffChunkManifests = (oldManifest: ChunkManifest | null, newManifest: ChunkManifest): ChunkDiff => {
  const added = new Map<ChunkId, ChunkInfo>();
  const updated = new Map<ChunkId, ChunkInfo>();
  const removed = new Set<ChunkId>();

  if (!oldManifest) {
    // Everything is new
    return {
      added: new Map(newManifest.chunks),
      updated: new Map(),
      removed: new Set(),
    };
  }

  // Find added and updated chunks
  for (const [id, newChunk] of newManifest.chunks) {
    const oldChunk = oldManifest.chunks.get(id);
    if (!oldChunk) {
      added.set(id, newChunk);
    } else if (oldChunk.contentHash !== newChunk.contentHash) {
      updated.set(id, newChunk);
    }
  }

  // Find removed chunks
  for (const id of oldManifest.chunks.keys()) {
    if (!newManifest.chunks.has(id)) {
      removed.add(id);
    }
  }

  return {
    added,
    updated,
    removed,
  };
};
