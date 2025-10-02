import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BuilderArtifactSchema,
  type BuilderArtifact,
  type BuilderArtifactEntry,
  type CanonicalId,
  createCanonicalId,
} from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

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
    return ok(validated as unknown as BuilderArtifact);
  } catch (error) {
    return err({
      type: "ArtifactError",
      code: error instanceof SyntaxError ? "PARSE_FAILED" : "VALIDATION_FAILED",
      path: resolvedPath,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const resolveCanonicalId = (filename: string, astPath: string): CanonicalId =>
  createCanonicalId(resolve(filename), astPath);

export const lookupArtifact = (artifact: BuilderArtifact, canonicalId: string): BuilderArtifactEntry | undefined => {
  return artifact.artifacts[canonicalId as CanonicalId];
};
