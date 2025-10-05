import type { IntermediateArtifactElement } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { DependencyGraph, DependencyGraphNode } from "../dependency-graph/types";
import type { BuilderError } from "../types";
import type { BuilderArtifactElement } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const emitRegistrationError = (node: DependencyGraphNode, message: string): BuilderError => ({
  code: "MODULE_EVALUATION_FAILED",
  filePath: canonicalToFilePath(node.id),
  astPath: node.definition.astPath,
  message,
});

type AggregateInput = {
  readonly graph: DependencyGraph;
  readonly elements: Record<string, IntermediateArtifactElement>;
};

export const aggregate = ({ graph, elements }: AggregateInput): Result<Map<string, BuilderArtifactElement>, BuilderError> => {
  const registry = new Map<string, BuilderArtifactElement>();

  for (const node of graph.values()) {
    const element = elements[node.id];
    if (!element) {
      const availableIds = Object.keys(elements).join(", ");
      const message = `ARTIFACT_NOT_FOUND_IN_RUNTIME_MODULE: ${node.id}\nAvailable: ${availableIds}`;
      return err(emitRegistrationError(node, message));
    }

    if (registry.has(node.id)) {
      return err(emitRegistrationError(node, `ARTIFACT_ALREADY_REGISTERED`));
    }

    if (element.type === "model") {
      registry.set(node.id, {
        id: node.id,
        type: "model",
        prebuild: { typename: element.element.typename },
      });
      continue;
    }

    if (element.type === "slice") {
      registry.set(node.id, {
        id: node.id,
        type: "slice",
        prebuild: { operationType: element.element.operationType },
      });
      continue;
    }

    if (element.type === "operation") {
      registry.set(node.id, {
        id: node.id,
        type: "operation",
        prebuild: {
          operationType: element.element.operationType,
          operationName: element.element.operationName,
          document: element.element.document,
          variableNames: element.element.variableNames,
          projectionPathGraph: element.element.projectionPathGraph,
        },
      });
      continue;
    }

    return err(emitRegistrationError(node, "UNKNOWN_ARTIFACT_KIND"));
  }

  return ok(registry);
};
