import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "neverthrow";

import type { DependencyGraph, DependencyGraphNode } from "./dependency-graph";
import type { IntermediateModule } from "./intermediate-module";
import type { ModuleLoadStats } from "./module-loader";
import { createOperationRegistry } from "./registry";
import type { BuilderArtifact, BuilderError } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

// const computeModelHash = (canonicalId: string, dependencies: readonly string[]): string =>
//   Bun.hash(`${canonicalId}:${dependencies.join(",")}`).toString(16);

// const stripDocument = (document: DocumentNode): DocumentNode =>
//   JSON.parse(
//     JSON.stringify(document, (key, value) => {
//       if (key === "loc") {
//         return undefined;
//       }

//       return value;
//     }),
//   ) as DocumentNode;

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

  // Classify nodes based on intermediate module evaluation
  const modelNodes: DependencyGraphNode[] = [];
  const sliceNodes: DependencyGraphNode[] = [];
  const operationNodes: DependencyGraphNode[] = [];

  graph.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.id in models) {
      modelNodes.push(node);
      return;
    }

    if (node.id in slices) {
      sliceNodes.push(node);
      return;
    }

    if (node.id in operations) {
      operationNodes.push(node);
    }
  });

  for (const model of modelNodes) {
    const descriptor = models[model.id];
    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(model.id),
        astPath: model.definition.astPath,
        message: "MODEL_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const result = registry.registerModel({
      type: "model",
      id: model.id,
      prebuild: {
        typename: descriptor.typename,
      },
    });

    if (result.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(model.id),
        astPath: model.definition.astPath,
        message: result.error.code,
      });
    }
  }

  for (const slice of sliceNodes) {
    const descriptor = slices[slice.id];

    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(slice.id),
        astPath: slice.definition.astPath,
        message: "SLICE_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const result = registry.registerSlice({
      type: "slice",
      id: slice.id,
      prebuild: {
        operationType: descriptor.operationType,
      },
    });

    if (result.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(slice.id),
        astPath: slice.definition.astPath,
        message: result.error.code,
      });
    }
  }

  for (const operation of operationNodes) {
    const descriptor = operations[operation.id];

    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(operation.id),
        astPath: operation.definition.astPath,
        message: "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const documentName = descriptor.operationName;

    const result = registry.registerOperation({
      type: "operation",
      id: operation.id,
      prebuild: {
        operationType: descriptor.operationType,
        operationName: documentName,
        document: descriptor.document,
        variableNames: descriptor.variableNames,
        projectionPathGraph: descriptor.projectionPathGraph,
      },
    });

    if (result.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(operation.id),
        astPath: operation.definition.astPath,
        message: result.error.code,
      });
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
      operations: operationNodes.length,
      models: modelNodes.length,
      slices: sliceNodes.length,
      durationMs: 0,
      warnings,
      cache,
    },
  } satisfies BuilderArtifact);
};
