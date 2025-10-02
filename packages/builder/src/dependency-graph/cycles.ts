import { err, ok, type Result } from "neverthrow";
import type { CanonicalId } from "../utils/canonical-id";
import type { DependencyGraph, DependencyGraphError } from "./types";

export const detectCycles = (graph: DependencyGraph): Result<void, DependencyGraphError> => {
  const visited = new Set<CanonicalId>();
  const stack = new Set<CanonicalId>();

  const visit = (nodeId: CanonicalId, chain: CanonicalId[]): Result<void, DependencyGraphError> => {
    if (stack.has(nodeId)) {
      return err({
        code: "CIRCULAR_DEPENDENCY",
        chain: [...chain, nodeId],
      });
    }

    if (visited.has(nodeId)) {
      return ok(undefined);
    }

    visited.add(nodeId);
    stack.add(nodeId);

    const node = graph.get(nodeId);
    if (node) {
      for (const dependency of node.dependencies) {
        const result = visit(dependency, [...chain, nodeId]);
        if (result.isErr()) {
          return result;
        }
      }
    }

    stack.delete(nodeId);
    return ok(undefined);
  };

  for (const nodeId of graph.keys()) {
    const result = visit(nodeId, []);
    if (result.isErr()) {
      return result;
    }
  }

  return ok(undefined);
};
