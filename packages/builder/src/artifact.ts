import { print } from "graphql";
import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "neverthrow";

import type { ModuleLoadStats } from "./module-loader";
import type { ParsedQuery } from "./discover";
import { createCanonicalId, createDocumentRegistry } from "./registry";
import type { BuilderArtifact, BuilderError } from "./types";

export type BuildArtifactInput = {
  readonly queries: readonly ParsedQuery[];
  readonly sliceCount: number;
  readonly cache: ModuleLoadStats;
};

export const buildArtifact = async ({
  queries,
  sliceCount,
  cache,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const registry = createDocumentRegistry<unknown>();
  const refRecords: Array<[string, { readonly kind: "query" | "slice" | "model"; readonly document?: string }]> = [];

  for (const query of queries) {
    const moduleUrl = pathToFileURL(query.filePath).href;

    let moduleExports: Record<string, unknown>;
    try {
      moduleExports = (await import(moduleUrl)) as Record<string, unknown>;
    } catch (error) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const exported = moduleExports?.[query.exportName] as
      | {
          readonly document?: unknown;
          readonly variables?: Record<string, string>;
        }
      | undefined;

    if (!exported || typeof exported !== "object") {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: "EXPORT_NOT_FOUND",
      });
    }

    if (!("document" in exported)) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: "EXPORT_MISSING_DOCUMENT",
      });
    }

    let text: string;
    try {
      text = print(exported.document as unknown);
    } catch (error) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const id = createCanonicalId(query.filePath, query.exportName);

    const refResult = registry.registerRef({
      id,
      kind: "operation",
      metadata: {
        canonicalDocument: query.name,
      },
      loader: () => ok(exported),
    });

    if (refResult.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: refResult.error.code,
      });
    }

    const documentResult = registry.registerDocument({
      name: query.name,
      text,
      variables: exported.variables ?? {},
      sourcePath: query.filePath,
    });

    if (documentResult.isErr()) {
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: query.filePath,
        exportName: query.exportName,
        message: documentResult.error.code,
      });
    }

    refRecords.push([
      id,
      {
        kind: "query",
        document: query.name,
      },
    ]);
  }

  const snapshot = registry.snapshot();
  const refsTree: Record<string, unknown> = Object.fromEntries(refRecords);

  const documents: BuilderArtifact["documents"] = Object.fromEntries(
    Object.entries(snapshot.documents).map(([name, entry]) => [name, { ...entry, variables: { ...entry.variables } }]),
  );

  const warnings: string[] = [];
  if (sliceCount >= 16) {
    warnings.push(`Warning: slice count ${sliceCount}`);
  }

  return ok({
    documents,
    refs: refsTree,
    refMap: Object.fromEntries(refRecords),
    report: {
      documents: queries.length,
      models: 0,
      slices: sliceCount,
      durationMs: 0,
      warnings,
      cache,
    },
  });
};
