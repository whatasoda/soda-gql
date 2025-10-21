/**
 * Error types for plugin-swc.
 * Re-exports from @soda-gql/plugin-common.
 */

export type {
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginBuilderCircularDependencyError,
  PluginBuilderDocDuplicateError,
  PluginBuilderEntryNotFoundError,
  PluginBuilderModuleEvaluationFailedError,
  PluginBuilderUnexpectedError,
  PluginBuilderWriteFailedError,
  PluginError,
  PluginOptionsInvalidBuilderConfigError,
} from "@soda-gql/plugin-common";

export { assertUnreachable, formatPluginError, isPluginError } from "@soda-gql/plugin-common";
