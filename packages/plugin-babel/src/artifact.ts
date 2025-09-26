import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BuilderArtifact, CanonicalId } from "@soda-gql/builder";
import { createCanonicalId } from "@soda-gql/builder";

export const loadArtifact = (path: string): BuilderArtifact => {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
  }

  const contents = readFileSync(resolvedPath, "utf8");
  return JSON.parse(contents) as BuilderArtifact;
};

export const resolveCanonicalId = (filename: string, exportName: string): CanonicalId =>
  createCanonicalId(resolve(filename), exportName);

export const lookupRef = (
  artifact: BuilderArtifact,
  canonicalId: string,
):
  | { readonly kind: "query" | "slice" | "model"; readonly document?: string; readonly dependencies?: readonly string[] }
  | undefined => {
  const entry = artifact.refs[canonicalId as CanonicalId];
  if (!entry) {
    return undefined;
  }

  if (entry.kind === "operation") {
    return {
      kind: "query",
      document: entry.metadata.canonicalDocument,
      dependencies: entry.metadata.dependencies,
    };
  }

  if (entry.kind === "slice") {
    return {
      kind: "slice",
      document: entry.metadata.canonicalDocuments[0],
      dependencies: entry.metadata.dependencies,
    };
  }

  return {
    kind: "model",
  };
};
