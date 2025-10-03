import { err, ok, type Result } from "neverthrow";
import type { ArtifactSource, SodaGqlBabelOptions } from "./types";

export type NormalizedOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly importIdentifier: string;
  readonly diagnostics: "json" | "console";
  readonly artifactSource: ArtifactSource;
};

export type OptionsError =
  | {
      readonly type: "OptionsError";
      readonly code: "MISSING_ARTIFACT_PATH";
      readonly message: string;
    }
  | {
      readonly type: "OptionsError";
      readonly code: "INVALID_BUILDER_CONFIG";
      readonly message: string;
    };

export const normalizeOptions = (raw: Partial<SodaGqlBabelOptions>): Result<NormalizedOptions, OptionsError> => {
  const mode = raw.mode ?? "runtime";
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";

  // Determine artifact source
  let artifactSource: ArtifactSource;

  if (raw.artifactSource) {
    // New discriminated union path
    if (raw.artifactSource.source === "artifact-file") {
      if (!raw.artifactSource.path) {
        return err({
          type: "OptionsError",
          code: "MISSING_ARTIFACT_PATH",
          message: "artifactsPath option is required",
        });
      }
      artifactSource = raw.artifactSource;
    } else {
      // source === "builder"
      const config = raw.artifactSource.config;
      if (!config.entry || config.entry.length === 0) {
        return err({
          type: "OptionsError",
          code: "INVALID_BUILDER_CONFIG",
          message: "builder config must include non-empty entry array",
        });
      }
      if (!config.analyzer) {
        return err({
          type: "OptionsError",
          code: "INVALID_BUILDER_CONFIG",
          message: "builder config must include analyzer",
        });
      }

      // Default mode to plugin mode if not specified
      artifactSource = {
        source: "builder",
        config: {
          ...config,
          mode: config.mode ?? mode,
        },
      };
    }
  } else if (raw.artifactsPath) {
    // Legacy fallback path
    artifactSource = {
      source: "artifact-file",
      path: raw.artifactsPath,
    };
  } else {
    // No artifact source provided
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
    artifactSource,
  });
};
