import type { CanonicalId } from "../canonical-id/canonical-id";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "./types";

/**
 * Represents an incremental update to the dependency graph.
 * Allows updating graph, indexes, and chunk manifest consistently.
 */
export type DependencyGraphPatch = {
  /** Normalized file paths of removed modules */
  readonly removedModules: Set<string>;
  /** Canonical IDs of definitions deleted inside surviving modules */
  readonly removedNodes: Set<CanonicalId>;
  /** Definitions re-emitted or newly added */
  readonly upsertNodes: Map<CanonicalId, DependencyGraphNode>;
  /** Fresh summaries for touched modules */
  readonly moduleSummaries: Map<string, ModuleSummary>;
};

/**
 * Graph index: file path -> set of canonical IDs defined in that file.
 */
export type GraphIndex = Map<string, Set<CanonicalId>>;

/**
 * Build a graph index from a dependency graph.
 */
export const buildGraphIndex = (graph: DependencyGraph): GraphIndex => {
  const index = new Map<string, Set<CanonicalId>>();

  for (const node of graph.values()) {
    const { filePath, id } = node;
    if (!index.has(filePath)) {
      index.set(filePath, new Set());
    }
    index.get(filePath)?.add(id);
  }

  return index;
};

/**
 * Apply a patch to the dependency graph, updating the graph and index in place.
 */
export const applyGraphPatch = (graph: DependencyGraph, index: GraphIndex, patch: DependencyGraphPatch): void => {
  // 1. Remove entire modules
  for (const modulePath of patch.removedModules) {
    const ids = index.get(modulePath);
    if (ids) {
      for (const id of ids) {
        graph.delete(id);
      }
      index.delete(modulePath);
    }
  }

  // 2. Remove individual nodes
  for (const nodeId of patch.removedNodes) {
    const node = graph.get(nodeId);
    if (node) {
      const ids = index.get(node.filePath);
      if (ids) {
        ids.delete(nodeId);
        if (ids.size === 0) {
          index.delete(node.filePath);
        }
      }
      graph.delete(nodeId);
    }
  }

  // 3. Upsert nodes (add or update)
  for (const [id, node] of patch.upsertNodes) {
    graph.set(id, node);
    if (!index.has(node.filePath)) {
      index.set(node.filePath, new Set());
    }
    index.get(node.filePath)?.add(id);
  }
};
