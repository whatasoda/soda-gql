import type { BuilderArtifact, BuilderArtifactElement, BuilderError, CanonicalId } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

import type { ArtifactError } from "./cache";
import type { NormalizedOptions, OptionsError } from "./options";

type OptionsMissingArtifactPath = Extract<OptionsError, { code: "MISSING_ARTIFACT_PATH" }>;
type OptionsInvalidBuilderConfig = Extract<OptionsError, { code: "INVALID_BUILDER_CONFIG" }>;

type ArtifactNotFound = Extract<ArtifactError, { code: "NOT_FOUND" }>;
type ArtifactParseFailed = Extract<ArtifactError, { code: "PARSE_FAILED" }>;
type ArtifactValidationFailed = Extract<ArtifactError, { code: "VALIDATION_FAILED" }>;

type BuilderEntryNotFound = Extract<BuilderError, { code: "ENTRY_NOT_FOUND" }>;
type BuilderDocDuplicate = Extract<BuilderError, { code: "DOC_DUPLICATE" }>;
type BuilderCircularDependency = Extract<BuilderError, { code: "GRAPH_CIRCULAR_DEPENDENCY" }>;
type BuilderModuleEvaluationFailed = Extract<BuilderError, { code: "RUNTIME_MODULE_LOAD_FAILED" }>;
type BuilderWriteFailed = Extract<BuilderError, { code: "WRITE_FAILED" }>;

type AnalysisMetadataMissingCause = { readonly filename: string };
type AnalysisArtifactMissingCause = { readonly filename: string; readonly canonicalId: CanonicalId };
type AnalysisUnsupportedArtifactTypeCause = {
  readonly filename: string;
  readonly canonicalId: CanonicalId;
  readonly artifactType: string;
};

type PluginErrorBase<Code extends string, Cause> = {
  readonly type: "PluginError";
  readonly code: Code;
  readonly message: string;
  readonly cause: Cause;
};

export type PluginOptionsMissingArtifactPathError = PluginErrorBase<
  "OPTIONS_MISSING_ARTIFACT_PATH",
  OptionsMissingArtifactPath | Extract<OptionsError, { code: "INVALID_ARTIFACT_OVERRIDE" }>
> & { readonly stage: "normalize-options" };

export type PluginOptionsInvalidBuilderConfigError = PluginErrorBase<
  "OPTIONS_INVALID_BUILDER_CONFIG",
  | OptionsInvalidBuilderConfig
  | Extract<OptionsError, { code: "MISSING_BUILDER_CONFIG" | "CONFIG_LOAD_FAILED" | "PROJECT_NOT_FOUND" }>
> & { readonly stage: "normalize-options" };

export type PluginArtifactNotFoundError = PluginErrorBase<"SODA_GQL_ARTIFACT_NOT_FOUND", ArtifactNotFound> & {
  readonly stage: "artifact";
  readonly path: string;
};

export type PluginArtifactParseFailedError = PluginErrorBase<"SODA_GQL_ARTIFACT_PARSE_FAILED", ArtifactParseFailed> & {
  readonly stage: "artifact";
  readonly path: string;
};

export type PluginArtifactValidationFailedError = PluginErrorBase<
  "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
  ArtifactValidationFailed
> & { readonly stage: "artifact"; readonly path: string };

export type PluginBuilderEntryNotFoundError = PluginErrorBase<"SODA_GQL_BUILDER_ENTRY_NOT_FOUND", BuilderEntryNotFound> & {
  readonly stage: "builder";
  readonly entry: string;
};

export type PluginBuilderDocDuplicateError = PluginErrorBase<"SODA_GQL_BUILDER_DOC_DUPLICATE", BuilderDocDuplicate> & {
  readonly stage: "builder";
  readonly name: string;
  readonly sources: readonly string[];
};

export type PluginBuilderCircularDependencyError = PluginErrorBase<
  "SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY",
  BuilderCircularDependency
> & { readonly stage: "builder"; readonly chain: readonly string[] };

export type PluginBuilderModuleEvaluationFailedError = PluginErrorBase<
  "SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED",
  BuilderModuleEvaluationFailed
> & { readonly stage: "builder"; readonly filePath: string; readonly astPath: string };

export type PluginBuilderWriteFailedError = PluginErrorBase<"SODA_GQL_BUILDER_WRITE_FAILED", BuilderWriteFailed> & {
  readonly stage: "builder";
  readonly outPath: string;
};

export type PluginBuilderUnexpectedError = PluginErrorBase<"SODA_GQL_BUILDER_UNEXPECTED", unknown> & {
  readonly stage: "builder";
};

export type PluginAnalysisMetadataMissingError = PluginErrorBase<"SODA_GQL_METADATA_NOT_FOUND", AnalysisMetadataMissingCause> & {
  readonly stage: "analysis";
  readonly filename: string;
};

export type PluginAnalysisArtifactMissingError = PluginErrorBase<
  "SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND",
  AnalysisArtifactMissingCause
> & { readonly stage: "analysis"; readonly filename: string; readonly canonicalId: CanonicalId };

export type PluginAnalysisUnsupportedArtifactTypeError = PluginErrorBase<
  "SODA_GQL_UNSUPPORTED_ARTIFACT_TYPE",
  AnalysisUnsupportedArtifactTypeCause
> & {
  readonly stage: "analysis";
  readonly filename: string;
  readonly canonicalId: CanonicalId;
  readonly artifactType: string;
};

export type PluginError =
  | PluginOptionsMissingArtifactPathError
  | PluginOptionsInvalidBuilderConfigError
  | PluginArtifactNotFoundError
  | PluginArtifactParseFailedError
  | PluginArtifactValidationFailedError
  | PluginBuilderEntryNotFoundError
  | PluginBuilderDocDuplicateError
  | PluginBuilderCircularDependencyError
  | PluginBuilderModuleEvaluationFailedError
  | PluginBuilderWriteFailedError
  | PluginBuilderUnexpectedError
  | PluginAnalysisMetadataMissingError
  | PluginAnalysisArtifactMissingError
  | PluginAnalysisUnsupportedArtifactTypeError;

type AllArtifacts = Record<CanonicalId, BuilderArtifactElement>;

export type PluginState = {
  readonly options: NormalizedOptions;
  readonly allArtifacts: AllArtifacts;
  readonly artifactProvider?: import("./artifact").ArtifactProvider;
};

export type PluginStateResult = Result<PluginState, PluginError>;

/**
 * New preparePluginState that uses new PluginOptions and ArtifactProvider
 */
export const preparePluginState = async (rawOptions: Partial<import("./types").PluginOptions>): Promise<PluginStateResult> => {
  // Dynamically import to avoid circular dependency
  const { normalizePluginOptions: normalizeNew } = await import("./options");
  const { createArtifactProvider } = await import("./artifact");

  const optionsResult = await normalizeNew(rawOptions);

  if (optionsResult.isErr()) {
    return err(mapOptionsError(optionsResult.error));
  }

  const options = optionsResult.value;

  // Use artifact provider abstraction
  const provider = createArtifactProvider(options);
  const artifactResult = await provider.load();

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  return ok(createPluginStateWithProvider(options, artifactResult.value, provider));
};

const createAllArtifacts = (artifact: BuilderArtifact): AllArtifacts => artifact.elements;

const createPluginStateWithProvider = (
  options: NormalizedOptions,
  artifact: BuilderArtifact,
  provider: import("./artifact").ArtifactProvider,
): PluginState => ({
  options,
  allArtifacts: createAllArtifacts(artifact),
  artifactProvider: provider,
});

const mapOptionsError = (error: OptionsError): PluginError => {
  switch (error.code) {
    case "MISSING_ARTIFACT_PATH":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_MISSING_ARTIFACT_PATH",
        message: error.message,
        cause: error,
      };
    case "INVALID_BUILDER_CONFIG":
    case "MISSING_BUILDER_CONFIG":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: error.message,
        cause: error,
      };
    case "CONFIG_LOAD_FAILED":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: `Config load failed: ${error.message}`,
        cause: error,
      };
    case "PROJECT_NOT_FOUND":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: `Project not found: ${error.project}`,
        cause: error,
      };
    case "INVALID_ARTIFACT_OVERRIDE":
      return {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_MISSING_ARTIFACT_PATH",
        message: error.message,
        cause: error,
      };
  }
};
