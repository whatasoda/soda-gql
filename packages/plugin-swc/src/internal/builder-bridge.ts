/**
 * Builder bridge for plugin-swc.
 * Replaces the shared coordinator infrastructure with a direct builder invocation.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { formatPluginError, type PluginError } from "./errors";

/**
 * Prepared transform state containing artifacts and configuration.
 */
export type PreparedState = {
  readonly importIdentifier: string;
  readonly allArtifacts: BuilderArtifact["elements"];
  readonly graphqlSystemPath: string;
};

/**
 * Options for preparing transform state.
 */
export type PrepareOptions = {
  readonly configPath?: string;
  readonly project?: string;
  readonly importIdentifier?: string;
  readonly packageLabel: string;
};

/**
 * Error types for the bridge.
 */
export type BridgeError =
  | { readonly type: "PLUGIN_ERROR"; readonly error: PluginError }
  | { readonly type: "BLOCKING_NOT_SUPPORTED"; readonly message: string };

/**
 * Prepare transform state by loading config and running builder.
 * This is a synchronous operation that eagerly builds artifacts.
 */
export const prepareTransformState = (options: PrepareOptions): Result<PreparedState, BridgeError> => {
  const { configPath, importIdentifier, packageLabel } = options;

  // Load configuration
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    const configError = configResult.error;
    const pluginError: PluginError = {
      type: "PluginError",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: `Failed to load configuration: ${configError.message}`,
      cause: {
        code: "CONFIG_LOAD_FAILED",
        message: configError.message,
      },
      stage: "normalize-options",
    };
    return err({ type: "PLUGIN_ERROR", error: pluginError });
  }

  const config = configResult.value;

  // Create builder service
  const builderService = createBuilderService({ config });

  // Run builder to get artifacts
  const buildResult = builderService.build();
  if (buildResult.isErr()) {
    const builderError = buildResult.error;

    // Map builder errors to plugin errors
    const pluginError: PluginError = {
      type: "PluginError",
      code: "SODA_GQL_BUILDER_UNEXPECTED",
      message: `Builder failed: ${builderError.message}`,
      cause: builderError,
      stage: "builder",
    };

    console.error(`[${packageLabel}] ${formatPluginError(pluginError)}`);
    return err({ type: "PLUGIN_ERROR", error: pluginError });
  }

  const artifact = buildResult.value;

  // Return prepared state
  // Derive graphqlSystemPath from outdir
  const graphqlSystemPath = `${config.outdir}/index.ts`;

  return ok({
    importIdentifier: importIdentifier ?? config.graphqlSystemAliases[0] ?? "@/graphql-system",
    allArtifacts: artifact.elements,
    graphqlSystemPath,
  });
};
