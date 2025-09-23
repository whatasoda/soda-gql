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
): { readonly kind: "query" | "slice" | "model"; readonly document?: string } | undefined => {
  if (artifact.refs && canonicalId in (artifact.refs as Record<string, unknown>)) {
    return (artifact.refs as Record<string, unknown>)[canonicalId] as {
      readonly kind: "query" | "slice" | "model";
      readonly document?: string;
    };
  }

  if (artifact.refMap && canonicalId in artifact.refMap) {
    return artifact.refMap[canonicalId as CanonicalId];
  }

  const segments = canonicalId.split(".");
  let cursor: unknown = artifact.refs;

  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return cursor as { readonly kind: "query" | "slice" | "model"; readonly document?: string } | undefined;
};
