import { pathToFileURL } from "node:url";
import { type DocumentNode, print } from "graphql";
import { err, ok, type Result } from "neverthrow";

import type { DependencyGraph, DependencyGraphNode } from "./dependency-graph";
import type { ModuleLoadStats } from "./module-loader";
import { createDocumentRegistry } from "./registry";
import type { BuilderArtifact, BuilderError } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const computeModelHash = (canonicalId: string, dependencies: readonly string[]): string =>
  Bun.hash(`${canonicalId}:${dependencies.join(",")}`).toString(16);

const stripDocument = (document: DocumentNode): DocumentNode =>
  JSON.parse(
    JSON.stringify(document, (key, value) => {
      if (key === "loc") {
        return undefined;
      }

      return value;
    }),
  ) as DocumentNode;

export type BuildArtifactInput = {
  readonly graph: DependencyGraph;
  readonly cache: ModuleLoadStats;
  readonly runtimeModulePath: string;
};

export const buildArtifact = async ({
  graph,
  cache,
  runtimeModulePath,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const registry = createDocumentRegistry<unknown>();

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

  let runtimeModule: Record<string, unknown>;
  try {
    runtimeModule = (await import(pathToFileURL(runtimeModulePath).href)) as Record<string, unknown>;
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: runtimeModulePath,
      exportName: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const runtimeOperations = (runtimeModule.operations ?? {}) as Record<string, Record<string, unknown>>;

  for (const model of modelNodes) {
    const hash = computeModelHash(model.id, model.dependencies);
    const result = registry.registerRef({
      id: model.id,
      kind: "model",
      metadata: {
        hash,
        dependencies: model.dependencies,
      },
      loader: () => ok(undefined),
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

  const sliceConsumers = new Map<string, Set<string>>();
  const documentNameToCanonical = new Map<string, string>();

  for (const operation of operationNodes) {
    const filePath = canonicalToFilePath(operation.id);
    const descriptor = runtimeOperations[operation.id];

    if (!descriptor || typeof descriptor !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath,
        exportName: operation.definition.exportName,
        message: "OPERATION_NOT_FOUND_IN_RUNTIME_MODULE",
      });
    }

    if (!("document" in descriptor)) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath,
        exportName: operation.definition.exportName,
        message: "EXPORT_MISSING_DOCUMENT",
      });
    }

    const operationDescriptor = descriptor as {
      readonly document: DocumentNode;
      readonly variables?: Record<string, string>;
      readonly name?: string;
    };

    let documentName: string | undefined = typeof operationDescriptor.name === "string" ? operationDescriptor.name : undefined;

    if (!documentName) {
      const document = operationDescriptor.document as unknown as {
        readonly definitions?: Array<{ readonly name?: { readonly value?: string } }>;
      };
      const definition = Array.isArray(document?.definitions)
        ? document.definitions.find((entry) => entry?.name?.value)
        : undefined;
      const inferred = definition?.name?.value;
      if (typeof inferred === "string" && inferred.length > 0) {
        documentName = inferred;
      }
    }

    if (!documentName || documentName.length === 0) {
      documentName = operation.definition.exportName;
    }

    const duplicate = documentNameToCanonical.get(documentName);
    if (duplicate && duplicate !== operation.id) {
      return err({
        code: "DOC_DUPLICATE",
        name: documentName,
        sources: [canonicalToFilePath(duplicate), filePath],
      });
    }

    let text: string;
    try {
      text = print(operationDescriptor.document);
    } catch (error) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath,
        exportName: operation.definition.exportName,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const registerResult = registry.registerRef({
      id: operation.id,
      kind: "operation",
      metadata: {
        canonicalDocument: documentName,
        dependencies: operation.dependencies,
      },
      loader: () => ok(operationDescriptor),
    });

    if (registerResult.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath,
        exportName: operation.definition.exportName,
        message: registerResult.error.code,
      });
    }

    const documentResult = registry.registerDocument({
      name: documentName,
      text,
      variables: operationDescriptor.variables ?? {},
      sourcePath: filePath,
      ast: stripDocument(operationDescriptor.document as DocumentNode),
    });

    if (documentResult.isErr()) {
      if (documentResult.error.code === "DOCUMENT_ALREADY_REGISTERED") {
        const prior = documentNameToCanonical.get(documentName) ?? operation.id;
        return err({
          code: "DOC_DUPLICATE",
          name: documentName,
          sources: [canonicalToFilePath(prior), filePath],
        });
      }

      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath,
        exportName: operation.definition.exportName,
        message: documentResult.error.code,
      });
    }

    documentNameToCanonical.set(documentName, operation.id);

    operation.dependencies.forEach((dependency) => {
      const target = graph.get(dependency);
      if (target?.definition.kind !== "slice") {
        return;
      }

      const consumers = sliceConsumers.get(dependency) ?? new Set<string>();
      if (documentName) {
        consumers.add(documentName);
      }
      sliceConsumers.set(dependency, consumers);
    });
  }

  for (const slice of sliceNodes) {
    const documents = Array.from(sliceConsumers.get(slice.id) ?? []);
    const result = registry.registerRef({
      id: slice.id,
      kind: "slice",
      metadata: {
        dependencies: slice.dependencies,
        canonicalDocuments: documents,
      },
      loader: () => ok(undefined),
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

  const snapshot = registry.snapshot();
  const documents: BuilderArtifact["documents"] = Object.fromEntries(
    Object.entries(snapshot.documents).map(([name, entry]) => [name, { ...entry, variables: { ...entry.variables } }]),
  );

  const warnings: string[] = [];
  if (sliceNodes.length >= 16) {
    warnings.push(`Warning: slice count ${sliceNodes.length}`);
  }

  return ok({
    documents,
    refs: snapshot.refs,
    report: {
      documents: operationNodes.length,
      models: modelNodes.length,
      slices: sliceNodes.length,
      durationMs: 0,
      warnings,
      cache,
    },
  });
};
