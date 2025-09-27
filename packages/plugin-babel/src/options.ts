import { err, ok, type Result } from "neverthrow";
import type { SodaGqlBabelOptions } from "./types";

export type NormalizedOptions = SodaGqlBabelOptions;

export type OptionsError = {
  type: "OptionsError";
  code: "MISSING_ARTIFACT_PATH";
  message: string;
};

export const normalizeOptions = (raw: Partial<SodaGqlBabelOptions>): Result<NormalizedOptions, OptionsError> => {
  const mode = raw.mode ?? "runtime";
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";
  const artifactsPath = raw.artifactsPath ?? "";

  if (!artifactsPath) {
    return err({
      type: "OptionsError",
      code: "MISSING_ARTIFACT_PATH",
      message: "artifactsPath option is required",
    });
  }

  return ok({
    mode,
    importIdentifier,
    diagnostics,
    artifactsPath,
  });
};
