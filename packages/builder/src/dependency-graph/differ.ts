import type { CanonicalId } from "../canonical-id";
import type { DependencyGraphPatch } from "./patcher";
import type { DependencyGraph, DependencyGraphNode, ModuleSummary } from "./types";

/**
 * Compute a patch from the difference between old and new dependency graphs.
 *
 * @param oldGraph - The previous dependency graph
 * @param newGraph - The new dependency graph
 * @returns A DependencyGraphPatch describing changes
 */
export const diffDependencyGraphs = (oldGraph: DependencyGraph, newGraph: DependencyGraph): DependencyGraphPatch => {
  const removedModules = new Set<string>();
  const removedNodes = new Set<CanonicalId>();
  const upsertNodes = new Map<CanonicalId, DependencyGraphNode>();
  const moduleSummaries = new Map<string, ModuleSummary>();

  // Track which modules exist in old and new graphs
  const oldModules = new Set<string>();
  const newModules = new Set<string>();

  for (const node of oldGraph.values()) {
    oldModules.add(node.filePath);
  }

  for (const node of newGraph.values()) {
    newModules.add(node.filePath);
  }

  // Find removed modules (all nodes from this file are gone)
  for (const module of oldModules) {
    if (!newModules.has(module)) {
      removedModules.add(module);
    }
  }

  // Find removed and updated nodes
  for (const [id, oldNode] of oldGraph.entries()) {
    const newNode = newGraph.get(id);

    if (!newNode) {
      // Node was removed
      removedNodes.add(id);
    } else if (!nodesEqual(oldNode, newNode)) {
      // Node was updated
      upsertNodes.set(id, newNode);
      moduleSummaries.set(newNode.filePath, newNode.moduleSummary);
    }
  }

  // Find added nodes
  for (const [id, newNode] of newGraph.entries()) {
    if (!oldGraph.has(id)) {
      upsertNodes.set(id, newNode);
      moduleSummaries.set(newNode.filePath, newNode.moduleSummary);
    }
  }

  return {
    removedModules,
    removedNodes,
    upsertNodes,
    moduleSummaries,
  };
};

/**
 * Check if two dependency graph nodes are equal.
 * Compares all fields except object identity.
 */
const nodesEqual = (a: DependencyGraphNode, b: DependencyGraphNode): boolean => {
  // Compare basic fields
  if (a.id !== b.id || a.filePath !== b.filePath || a.localPath !== b.localPath || a.isExported !== b.isExported) {
    return false;
  }

  // Compare dependencies (order matters)
  if (a.dependencies.length !== b.dependencies.length) {
    return false;
  }

  for (let i = 0; i < a.dependencies.length; i++) {
    if (a.dependencies[i] !== b.dependencies[i]) {
      return false;
    }
  }

  // Compare definition (simplified - just check expression and astPath)
  if (a.definition.expression !== b.definition.expression || a.definition.astPath !== b.definition.astPath) {
    return false;
  }

  return true;
};
