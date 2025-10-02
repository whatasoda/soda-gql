import { err, ok, type Result } from "neverthrow";
import type { DependencyGraph, DependencyGraphNode } from "../dependency-graph/types";
import type { IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";
import type { OperationRegistry } from "./registry";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const emitRegistrationError = (node: DependencyGraphNode, message: string): BuilderError => ({
  code: "MODULE_EVALUATION_FAILED",
  filePath: canonicalToFilePath(node.id),
  astPath: node.definition.astPath,
  message,
});

export const classifyAndRegister = (
  graph: DependencyGraph,
  intermediateModule: IntermediateModule,
  registry: OperationRegistry,
): Result<Map<string, DependencyGraphNode[]>, BuilderError> => {
  const { artifacts } = intermediateModule;

  // Classify and register nodes by looking up in the unified artifacts record
  const nodesByType = new Map<string, DependencyGraphNode[]>();

  // First pass: classify all nodes
  graph.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    const artifact = artifacts[node.id];
    if (!artifact) {
      return;
    }

    const nodes = nodesByType.get(artifact.kind) ?? [];
    nodes.push(node);
    nodesByType.set(artifact.kind, nodes);
  });

  // Second pass: register in order (models → slices → operations)
  const registrationOrder = ["model", "slice", "operation"] as const;

  for (const kind of registrationOrder) {
    const nodes = nodesByType.get(kind) ?? [];
    for (const node of nodes) {
      const artifact = artifacts[node.id];
      if (!artifact) {
        return err(emitRegistrationError(node, `${kind.toUpperCase()}_NOT_FOUND_IN_RUNTIME_MODULE`));
      }

      let result: Result<unknown, BuilderError>;

      if (artifact.kind === "model") {
        const descriptor = artifact.builder;
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "MODEL_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        result = registry
          .registerModel({
            type: "model",
            id: node.id,
            prebuild: { typename: descriptor.typename },
          })
          .mapErr((e) => emitRegistrationError(node, e.code));
      } else if (artifact.kind === "slice") {
        const descriptor = artifact.builder;
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "SLICE_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        result = registry
          .registerSlice({
            type: "slice",
            id: node.id,
            prebuild: { operationType: descriptor.operationType },
          })
          .mapErr((e) => emitRegistrationError(node, e.code));
      } else if (artifact.kind === "operation") {
        const descriptor = artifact.builder;
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        result = registry
          .registerOperation({
            type: "operation",
            id: node.id,
            prebuild: {
              operationType: descriptor.operationType,
              operationName: descriptor.operationName,
              document: descriptor.document,
              variableNames: descriptor.variableNames,
              projectionPathGraph: descriptor.projectionPathGraph,
            },
          })
          .mapErr((e) => emitRegistrationError(node, e.code));
      } else {
        return err(emitRegistrationError(node, "UNKNOWN_ARTIFACT_KIND"));
      }

      if (result.isErr()) {
        return err(result.error);
      }
    }
  }

  return ok(nodesByType);
};
