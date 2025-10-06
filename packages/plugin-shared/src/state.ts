import {
  type BuilderArtifact,
  type BuilderArtifactElement,
  type BuilderError,
  type CanonicalId,
  createBuilderService,
} from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

import { type ArtifactError, loadArtifact } from "./cache";
import { type NormalizedOptions, normalizePluginOptions, type OptionsError } from "./options";
import type { SodaGqlPluginOptions } from "./types";

type OptionsMissingArtifactPath = Extract<OptionsError, { code: "MISSING_ARTIFACT_PATH" }>;
type OptionsInvalidBuilderConfig = Extract<OptionsError, { code: "INVALID_BUILDER_CONFIG" }>;

type ArtifactNotFound = Extract<ArtifactError, { code: "NOT_FOUND" }>;
type ArtifactParseFailed = Extract<ArtifactError, { code: "PARSE_FAILED" }>;
type ArtifactValidationFailed = Extract<ArtifactError, { code: "VALIDATION_FAILED" }>;

type BuilderEntryNotFound = Extract<BuilderError, { code: "ENTRY_NOT_FOUND" }>;
type BuilderDocDuplicate = Extract<BuilderError, { code: "DOC_DUPLICATE" }>;
type BuilderCircularDependency = Extract<BuilderError, { code: "CIRCULAR_DEPENDENCY" }>;
type BuilderModuleEvaluationFailed = Extract<BuilderError, { code: "MODULE_EVALUATION_FAILED" }>;
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
  OptionsMissingArtifactPath
> & { readonly stage: "normalize-options" };

export type PluginOptionsInvalidBuilderConfigError = PluginErrorBase<
  "OPTIONS_INVALID_BUILDER_CONFIG",
  OptionsInvalidBuilderConfig
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
};

type PreparePluginStateDeps = {
  readonly normalizePluginOptions: typeof normalizePluginOptions;
  readonly loadArtifact: typeof loadArtifact;
  readonly createBuilderService: typeof createBuilderService;
};

const defaultDeps: PreparePluginStateDeps = {
  normalizePluginOptions,
  loadArtifact,
  createBuilderService,
};

export type PluginStateResult = Result<PluginState, PluginError>;

export const preparePluginState = async (
  rawOptions: Partial<SodaGqlPluginOptions>,
  deps: PreparePluginStateDeps = defaultDeps,
): Promise<PluginStateResult> => {
  const optionsResult = deps.normalizePluginOptions(rawOptions);

  if (optionsResult.isErr()) {
    return err(mapOptionsError(optionsResult.error));
  }

  const options = optionsResult.value;

  if (options.artifactSource.source === "artifact-file") {
    // loadArtifact is now async - await the result
    const artifactResult = await deps.loadArtifact(options.artifactSource.path);

    if (artifactResult.isErr()) {
      return err(mapArtifactError(artifactResult.error));
    }

    return ok(createPluginState(options, artifactResult.value));
  }

  const service = deps.createBuilderService(options.artifactSource.config);

  try {
    const buildResult = await service.build();

    if (buildResult.isErr()) {
      return err(mapBuilderError(buildResult.error));
    }

    return ok(createPluginState(options, buildResult.value));
  } catch (cause) {
    return err(mapUnexpectedBuilderError(cause));
  }
};

const createAllArtifacts = (artifact: BuilderArtifact): AllArtifacts => artifact.elements;

const createPluginState = (options: NormalizedOptions, artifact: BuilderArtifact): PluginState => ({
  options,
  allArtifacts: createAllArtifacts(artifact),
});

const mapOptionsError = (error: OptionsError): PluginError => {
  if (error.code === "MISSING_ARTIFACT_PATH") {
    return {
      type: "PluginError",
      stage: "normalize-options",
      code: "OPTIONS_MISSING_ARTIFACT_PATH",
      message: error.message,
      cause: error as OptionsMissingArtifactPath,
    };
  }

  return {
    type: "PluginError",
    stage: "normalize-options",
    code: "OPTIONS_INVALID_BUILDER_CONFIG",
    message: error.message,
    cause: error as OptionsInvalidBuilderConfig,
  };
};

const mapArtifactError = (error: ArtifactError): PluginError => {
  switch (error.code) {
    case "NOT_FOUND":
      return {
        type: "PluginError",
        stage: "artifact",
        code: "SODA_GQL_ARTIFACT_NOT_FOUND",
        message: "SODA_GQL_ARTIFACT_NOT_FOUND",
        cause: error as ArtifactNotFound,
        path: error.path,
      };
    case "PARSE_FAILED":
      return {
        type: "PluginError",
        stage: "artifact",
        code: "SODA_GQL_ARTIFACT_PARSE_FAILED",
        message: "SODA_GQL_ARTIFACT_PARSE_FAILED",
        cause: error as ArtifactParseFailed,
        path: error.path,
      };
    default:
      return {
        type: "PluginError",
        stage: "artifact",
        code: "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
        message: "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
        cause: error as ArtifactValidationFailed,
        path: error.path,
      };
  }
};

const mapBuilderError = (error: BuilderError): PluginError => {
  switch (error.code) {
    case "ENTRY_NOT_FOUND":
      return {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_ENTRY_NOT_FOUND",
        message: `SODA_GQL_BUILDER_ENTRY_NOT_FOUND: ${error.message} (entry: ${error.entry})`,
        cause: error as BuilderEntryNotFound,
        entry: error.entry,
      };
    case "DOC_DUPLICATE":
      return {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_DOC_DUPLICATE",
        message: `SODA_GQL_BUILDER_DOC_DUPLICATE: ${error.name} found in multiple sources: ${error.sources.join(", ")}`,
        cause: error as BuilderDocDuplicate,
        name: error.name,
        sources: error.sources,
      };
    case "CIRCULAR_DEPENDENCY":
      return {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY",
        message: `SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY: ${error.chain.join(" → ")}`,
        cause: error as BuilderCircularDependency,
        chain: error.chain,
      };
    case "MODULE_EVALUATION_FAILED":
      return {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED",
        message: `SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED: ${error.message} at ${error.filePath}:${error.astPath}`,
        cause: error as BuilderModuleEvaluationFailed,
        filePath: error.filePath,
        astPath: error.astPath,
      };
    case "WRITE_FAILED":
      return {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_WRITE_FAILED",
        message: `SODA_GQL_BUILDER_WRITE_FAILED: ${error.message} (path: ${error.outPath})`,
        cause: error as BuilderWriteFailed,
        outPath: error.outPath,
      };
    default:
      // Handle new error codes by falling back to unexpected error
      return mapUnexpectedBuilderError(error);
  }
};

const mapUnexpectedBuilderError = (cause: unknown): PluginBuilderUnexpectedError => ({
  type: "PluginError",
  stage: "builder",
  code: "SODA_GQL_BUILDER_UNEXPECTED",
  message: `SODA_GQL_BUILDER_UNEXPECTED: ${describeUnknown(cause)}`,
  cause,
});

const describeUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
