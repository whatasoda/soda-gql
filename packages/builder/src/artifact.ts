import { ok } from "neverthrow";
import type { ParsedQuery } from "./discover";
import { createCanonicalId, createDocumentRegistry } from "./registry";
import type { BuilderArtifact } from "./types";

export const buildArtifact = (queries: readonly ParsedQuery[]): BuilderArtifact => {
  const registry = createDocumentRegistry<undefined>();
  const refRecords: Array<[string, { readonly kind: "query" | "slice" | "model"; readonly document?: string }]> = [];

  queries.forEach((query) => {
    const id = createCanonicalId(query.filePath, query.exportName);
    registry.registerRef({
      id,
      kind: "operation",
      metadata: {
        canonicalDocument: query.name,
      },
      loader: () => ok(undefined),
    });

    registry.registerDocument({
      name: query.name,
      text: `query ${query.name} {}`,
      variables: {},
    });

    refRecords.push([
      id,
      {
        kind: "query",
        document: query.name,
      },
    ]);
  });

  const snapshot = registry.snapshot();
  const refsTree: Record<string, unknown> = {};

  const insertIntoTree = (
    tree: Record<string, unknown>,
    canonicalId: string,
    value: { readonly kind: "query" | "slice" | "model"; readonly document?: string },
  ): void => {
    const segments = canonicalId.split(".");
    let cursor: Record<string, unknown> = tree;

    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = value;
        return;
      }

      const existing = cursor[segment];
      if (existing && typeof existing === "object") {
        cursor = existing as Record<string, unknown>;
        return;
      }

      const next: Record<string, unknown> = {};
      cursor[segment] = next;
      cursor = next;
    });
  };

  refRecords.forEach(([id, value]) => {
    insertIntoTree(refsTree, id, value);
  });

  const documents: BuilderArtifact["documents"] = Object.fromEntries(
    Object.entries(snapshot.documents).map(([name, entry]) => [
      name,
      {
        ...entry,
        variables: {},
      },
    ]),
  );

  return {
    documents,
    refs: refsTree,
    refMap: Object.fromEntries(refRecords),
    report: {
      documents: queries.length,
      models: 0,
      slices: 0,
      durationMs: 0,
      warnings: [],
    },
  };
};
