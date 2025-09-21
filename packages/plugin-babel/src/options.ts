import type { SodaGqlBabelOptions } from "./types";

export type NormalizedOptions = SodaGqlBabelOptions;

export const normalizeOptions = (raw: Partial<SodaGqlBabelOptions>): NormalizedOptions => {
  const mode = raw.mode ?? "runtime";
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";
  const artifactsPath = raw.artifactsPath ?? "";

  if (!artifactsPath) {
    throw new Error("SODA_GQL_ARTIFACT_NOT_FOUND");
  }

  return {
    mode,
    importIdentifier,
    diagnostics,
    artifactsPath,
  };
};
