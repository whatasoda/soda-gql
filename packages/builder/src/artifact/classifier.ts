import { err, ok, type Result } from "neverthrow";
import type { DependencyGraph, DependencyGraphNode } from "../dependency-graph/types";
import type { IntermediateModule } from "../intermediate-module";
import type { OperationRegistry } from "../registry";
import type { BuilderError } from "../types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const emitRegistrationError = (node: DependencyGraphNode, message: string): BuilderError => ({
  code: "MODULE_EVALUATION_FAILED",
  filePath: canonicalToFilePath(node.id),
  astPath: node.definition.astPath,
  message,
});

type ClassificationRule = {
  readonly type: "model" | "slice" | "operation";
  readonly bucket: Record<string, unknown>;
  readonly register: (node: DependencyGraphNode) => Result<unknown, BuilderError>;
  readonly notFoundMessage: string;
};

export const classifyAndRegister = (
  graph: DependencyGraph,
  intermediateModule: IntermediateModule,
  registry: OperationRegistry,
): Result<Map<string, DependencyGraphNode[]>, BuilderError> => {
  const { models, slices, operations } = intermediateModule;

  // Classification rules for each node type
  const classificationRules: ClassificationRule[] = [
    {
      type: "model" as const,
      bucket: models,
      register: (node: DependencyGraphNode) => {
        const descriptor = models[node.id];
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "MODEL_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        return registry
          .registerModel({
            type: "model",
            id: node.id,
            prebuild: { typename: descriptor.typename },
          })
          .mapErr((e) => emitRegistrationError(node, e.code));
      },
      notFoundMessage: "MODEL_NOT_FOUND_IN_RUNTIME_MODULE",
    },
    {
      type: "slice" as const,
      bucket: slices,
      register: (node: DependencyGraphNode) => {
        const descriptor = slices[node.id];
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "SLICE_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        return registry
          .registerSlice({
            type: "slice",
            id: node.id,
            prebuild: { operationType: descriptor.operationType },
          })
          .mapErr((e) => emitRegistrationError(node, e.code));
      },
      notFoundMessage: "SLICE_NOT_FOUND_IN_RUNTIME_MODULE",
    },
    {
      type: "operation" as const,
      bucket: operations,
      register: (node: DependencyGraphNode) => {
        const descriptor = operations[node.id];
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        return registry
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
      },
      notFoundMessage: "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE",
    },
  ];

  // Classify and register nodes using the rule table
  const nodesByType = new Map<string, DependencyGraphNode[]>();

  graph.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    for (const rule of classificationRules) {
      if (node.id in rule.bucket) {
        const nodes = nodesByType.get(rule.type) ?? [];
        nodes.push(node);
        nodesByType.set(rule.type, nodes);
        return;
      }
    }
  });

  // Process nodes in order: models → slices → operations
  for (const rule of classificationRules) {
    const nodes = nodesByType.get(rule.type) ?? [];
    for (const node of nodes) {
      const result = rule.register(node);
      if (result.isErr()) {
        return err(emitRegistrationError(node, result.error.code));
      }
    }
  }

  return ok(nodesByType);
};
