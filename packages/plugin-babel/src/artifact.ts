import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CanonicalId } from "@soda-gql/builder";
import { createCanonicalId } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";
import { type BuilderArtifact, BuilderArtifactSchema } from "./schemas/artifact";

export type ArtifactError = {
  type: "ArtifactError";
  code: "NOT_FOUND" | "PARSE_FAILED" | "VALIDATION_FAILED";
  path: string;
  message: string;
};

export const loadArtifact = (path: string): Result<BuilderArtifact, ArtifactError> => {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return err({
      type: "ArtifactError",
      code: "NOT_FOUND",
      path: resolvedPath,
      message: "Artifact file not found",
    });
  }

  try {
    const contents = readFileSync(resolvedPath, "utf8");
    const parsed = JSON.parse(contents);
    const validated = BuilderArtifactSchema.parse(parsed);
    return ok(validated);
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: error instanceof SyntaxError ? "PARSE_FAILED" : "VALIDATION_FAILED",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
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
