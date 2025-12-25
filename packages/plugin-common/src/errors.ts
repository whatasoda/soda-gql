/**
 * Error types and formatters for plugin-babel.
 * Simplified from plugin-shared to include only types actually used by the Babel transformer.
 */

import type { BuilderError } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";

type OptionsInvalidBuilderConfig = { readonly code: "INVALID_BUILDER_CONFIG"; readonly message: string };
type OptionsMissingBuilderConfig = { readonly code: "MISSING_BUILDER_CONFIG"; readonly message: string };
type OptionsConfigLoadFailed = { readonly code: "CONFIG_LOAD_FAILED"; readonly message: string };

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
  OptionsInvalidBuilderConfig | OptionsMissingBuilderConfig | OptionsConfigLoadFailed
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

type TransformMissingBuilderArgCause = { readonly filename: string; readonly builderType: string; readonly argName: string };
type TransformUnsupportedValueTypeCause = { readonly valueType: string };
type TransformAstVisitorFailedCause = { readonly filename: string; readonly reason: string };

export type PluginTransformMissingBuilderArgError = PluginErrorBase<
  "SODA_GQL_TRANSFORM_MISSING_BUILDER_ARG",
  TransformMissingBuilderArgCause
> & {
  readonly stage: "transform";
  readonly filename: string;
  readonly builderType: string;
  readonly argName: string;
};

export type PluginTransformUnsupportedValueTypeError = PluginErrorBase<
  "SODA_GQL_TRANSFORM_UNSUPPORTED_VALUE_TYPE",
  TransformUnsupportedValueTypeCause
> & { readonly stage: "transform"; readonly valueType: string };

export type PluginTransformAstVisitorFailedError = PluginErrorBase<
  "SODA_GQL_TRANSFORM_AST_VISITOR_FAILED",
  TransformAstVisitorFailedCause
> & { readonly stage: "transform"; readonly filename: string; readonly reason: string };

/**
 * Union of all plugin error types.
 */
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
  | PluginAnalysisUnsupportedArtifactTypeError
  | PluginTransformMissingBuilderArgError
  | PluginTransformUnsupportedValueTypeError
  | PluginTransformAstVisitorFailedError;

/**
 * Format a PluginError into a human-readable message.
 */
export const formatPluginError = (error: PluginError): string => {
  const codePrefix = `[${error.code}]`;
  const stageInfo = "stage" in error ? ` (${error.stage})` : "";
  return `${codePrefix}${stageInfo} ${error.message}`;
};

/**
 * Type guard for PluginError.
 */
export const isPluginError = (value: unknown): value is PluginError => {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "PluginError" &&
    "code" in value &&
    "message" in value
  );
};

/**
 * Assertion helper for unreachable code paths.
 * This is the ONLY acceptable throw in plugin code.
 */
export const assertUnreachable = (value: never, context?: string): never => {
  throw new Error(`[INTERNAL] Unreachable code path${context ? ` in ${context}` : ""}: received ${JSON.stringify(value)}`);
};
