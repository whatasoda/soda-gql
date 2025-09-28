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

  const modelNodes: DependencyGraphNode[] = [];
  const sliceNodes: DependencyGraphNode[] = [];
  const operationNodes: DependencyGraphNode[] = [];

  graph.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.definition.kind === "model") {
      modelNodes.push(node);
      return;
    }

    if (node.definition.kind === "slice") {
      sliceNodes.push(node);
      return;
    }

    if (node.definition.kind === "operation") {
      operationNodes.push(node);
    }
  });

  let intermediateModule: IntermediateModule;
  try {
    intermediateModule = (await import(pathToFileURL(intermediateModulePath).href)) as IntermediateModule;
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: intermediateModulePath,
      exportName: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const { models, slices, operations } = intermediateModule;

  for (const model of modelNodes) {
    const descriptor = models[model.id];
    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(model.id),
        exportName: model.definition.exportName,
        message: "MODEL_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const result = registry.registerModel({
      id: model.id,
      prebuild: {
        typename: descriptor.typename,
      },
      dependencies: model.dependencies,
    });

    if (result.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(model.id),
        exportName: model.definition.exportName,
        message: result.error.code,
      });
    }
  }

  for (const slice of sliceNodes) {
    const descriptor = slices[slice.id];

    if (!descriptor || typeof descriptor !== "function") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(slice.id),
        exportName: slice.definition.exportName,
        message: "SLICE_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const result = registry.registerSlice({
      id: slice.id,
      prebuild: null,
      dependencies: slice.dependencies,
    });

    if (result.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(slice.id),
        exportName: slice.definition.exportName,
        message: result.error.code,
      });
    }
  }

  const documentNameToCanonical = new Map<string, string>();

  for (const operation of operationNodes) {
    const descriptor = operations[operation.id];

    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(operation.id),
        exportName: operation.definition.exportName,
        message: "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    const documentName = descriptor.name;
    const duplicate = documentNameToCanonical.get(documentName);
    if (duplicate && duplicate !== operation.id) {
      return err({
        code: "DOC_DUPLICATE",
        name: documentName,
        sources: [canonicalToFilePath(duplicate), canonicalToFilePath(operation.id)],
      });
    }

    // let text: string;
    // try {
    //   text = print(descriptor.document);
    // } catch (error) {
    //   return err({
    //     code: "MODULE_EVALUATION_FAILED",
    //     filePath,
    //     exportName: operation.definition.exportName,
    //     message: error instanceof Error ? error.message : String(error),
    //   });
    // }

    const result = registry.registerOperation({
      id: operation.id,
      prebuild: {
        name: documentName,
        document: descriptor.document,
        variableNames: descriptor.variableNames,
        projectionPathGraph: descriptor.projectionPathGraph,
      },
      dependencies: operation.dependencies,
    });

    if (result.isErr()) {
      if (result.error.code === "OPERATION_ALREADY_REGISTERED") {
        const prior = documentNameToCanonical.get(documentName) ?? operation.id;
        return err({
          code: "DOC_DUPLICATE",
          name: documentName,
          sources: [canonicalToFilePath(prior), canonicalToFilePath(operation.id)],
        });
      }

      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(operation.id),
        exportName: operation.definition.exportName,
        message: result.error.code,
      });
    }

    documentNameToCanonical.set(documentName, operation.id);
  }

  const snapshot = registry.snapshot();

  const warnings: string[] = [];
  if (sliceNodes.length >= 16) {
    warnings.push(`Warning: slice count ${sliceNodes.length}`);
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
