import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "neverthrow";

import type { DependencyGraph, DependencyGraphNode } from "./dependency-graph";
import type { IntermediateModule } from "./intermediate-module";
import type { ModuleLoadStats } from "./module-loader";
import { createOperationRegistry } from "./registry";
import type { BuilderArtifact, BuilderError } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

export type BuildArtifactInput = {
  readonly graph: DependencyGraph;
  readonly cache: ModuleLoadStats;
  readonly intermediateModulePath: string;
};

export const buildArtifact = async ({
  graph,
  cache,
  intermediateModulePath,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const registry = createOperationRegistry();

  // Load intermediate module first to classify definitions at runtime
  let intermediateModule: IntermediateModule;
  try {
    intermediateModule = (await import(pathToFileURL(intermediateModulePath).href)) as IntermediateModule;
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: intermediateModulePath,
      astPath: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const { models, slices, operations, issueRegistry } = intermediateModule;

  // Check for errors from issue registry
  const issues = issueRegistry.getIssues();
  for (const issue of issues) {
    if (issue.severity === "error") {
      // Convert issue to BuilderError
      if (issue.code === "DUPLICATE_OPERATION_NAME") {
        const sources = [canonicalToFilePath(issue.canonicalId)];
        if (issue.related) {
          sources.unshift(...issue.related.map(canonicalToFilePath));
        }
        return err({
          code: "DOC_DUPLICATE",
          name: issue.message.match(/"([^"]+)"/)?.[1] ?? "unknown",
          sources,
        });
      }
      // Handle other error codes if needed
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(issue.canonicalId),
        astPath: "",
        message: issue.message,
      });
    }
  }

  // Helper to emit registration errors
  const emitRegistrationError = (node: DependencyGraphNode, message: string): BuilderError => ({
    code: "MODULE_EVALUATION_FAILED",
    filePath: canonicalToFilePath(node.id),
    astPath: node.definition.astPath,
    message,
  });

  // Classification rules for each node type
  const classificationRules = [
    {
      type: "model" as const,
      bucket: models,
      register: (node: DependencyGraphNode) => {
        const descriptor = models[node.id];
        if (!descriptor || typeof descriptor !== "object") {
          return err(emitRegistrationError(node, "MODEL_NOT_FOUND_IN_RUNTIME_MODULE"));
        }
        return registry.registerModel({
          type: "model",
          id: node.id,
          prebuild: { typename: descriptor.typename },
        });
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
        return registry.registerSlice({
          type: "slice",
          id: node.id,
          prebuild: { operationType: descriptor.operationType },
        });
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
        return registry.registerOperation({
          type: "operation",
          id: node.id,
          prebuild: {
            operationType: descriptor.operationType,
            operationName: descriptor.operationName,
            document: descriptor.document,
            variableNames: descriptor.variableNames,
            projectionPathGraph: descriptor.projectionPathGraph,
          },
        });
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

  const snapshot = registry.snapshot();

  const warnings: string[] = [];

  // Add warnings from issue registry
  for (const issue of issues) {
    if (issue.severity === "warning") {
      warnings.push(`${issue.code}: ${issue.message} (${issue.canonicalId})`);
    }
  }

  return ok({
    operations: snapshot.operations,
    slices: snapshot.slices,
    models: snapshot.models,
    report: {
      operations: nodesByType.get("operation")?.length ?? 0,
      models: nodesByType.get("model")?.length ?? 0,
      slices: nodesByType.get("slice")?.length ?? 0,
      durationMs: 0,
      warnings,
      cache,
    },
  } satisfies BuilderArtifact);
};
