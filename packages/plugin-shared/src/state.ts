import type { BuilderArtifactElement, BuilderError, CanonicalId } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";
import type { CoordinatorKey, CoordinatorSnapshot } from "./coordinator/index.js";
import type { NormalizedOptions, OptionsError } from "./options.js";

type OptionsInvalidBuilderConfig = Extract<OptionsError, { code: "INVALID_BUILDER_CONFIG" }>;

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

export type PluginOptionsInvalidBuilderConfigError = PluginErrorBase<
  "OPTIONS_INVALID_BUILDER_CONFIG",
  OptionsInvalidBuilderConfig | Extract<OptionsError, { code: "MISSING_BUILDER_CONFIG" | "CONFIG_LOAD_FAILED" }>
> & { readonly stage: "normalize-options" };

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
  | PluginOptionsInvalidBuilderConfigError
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

/**
 * Plugin state with coordinator-based artifact management.
 */
export type PluginState = {
  readonly options: NormalizedOptions;
  readonly allArtifacts: AllArtifacts;
  readonly coordinatorKey: CoordinatorKey;
  readonly snapshot: CoordinatorSnapshot;
};

export type PluginStateResult = Result<PluginState, PluginError>;

/**
 * Prepare plugin state using coordinator.
 * Creates and registers a coordinator, then returns the initial snapshot.
 */
export const preparePluginState = async (rawOptions: Partial<import("./types.js").PluginOptions>): Promise<PluginStateResult> => {
  // Dynamically import to avoid circular dependency
  const { normalizePluginOptions } = await import("./options.js");
  const { createAndRegisterCoordinator } = await import("./coordinator/index.js");

  const optionsResult = await normalizePluginOptions(rawOptions);

  if (optionsResult.isErr()) {
    return err(mapOptionsError(optionsResult.error));
  }

  const options = optionsResult.value;

  // Create and register coordinator
  const { key, coordinator } = await createAndRegisterCoordinator(options);

  // Ensure latest artifact is built
  try {
    const snapshot = await coordinator.ensureLatest();

    return ok({
      options,
      allArtifacts: snapshot.elements,
      coordinatorKey: key,
      snapshot,
    });
  } catch (error) {
    // Coordinator throws on builder errors
    return err({
      type: "PluginError",
      stage: "builder",
      code: "SODA_GQL_BUILDER_UNEXPECTED",
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }
};

const mapOptionsError = (error: OptionsError): PluginError => {
  switch (error.code) {
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
  }
};
