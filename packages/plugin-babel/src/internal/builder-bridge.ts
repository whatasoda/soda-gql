/**
 * Builder bridge for plugin-babel.
 * Replaces the shared coordinator infrastructure with direct builder invocation.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { type PluginError } from "./errors.js";

/**
 * Normalized plugin options after validation.
 */
export type NormalizedOptions = {
  readonly importIdentifier: string;
  readonly diagnostics: "json" | "console";
  readonly resolvedConfig: ResolvedSodaGqlConfig;
  readonly project?: string;
  readonly graphqlSystemPath: string;
};

/**
 * Prepared plugin state containing artifacts and configuration.
 */
export type PluginState = {
  readonly options: NormalizedOptions;
  readonly allArtifacts: BuilderArtifact["elements"];
};

/**
 * Raw plugin options from Babel config.
 */
export type PluginOptions = {
  readonly configPath?: string;
  readonly project?: string;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
  readonly dev?: {
    readonly hmr?: boolean;
  };
};

/**
 * Normalize plugin options and resolve configuration.
 */
export const normalizePluginOptions = (raw: Partial<PluginOptions>): Result<NormalizedOptions, PluginError> => {
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";
  const project = raw.project;

  // Load config
  const configResult = loadConfig(raw.configPath);
  if (configResult.isErr()) {
    return err({
      type: "PluginError",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: `Failed to load config: ${configResult.error.message}`,
      cause: {
        code: "CONFIG_LOAD_FAILED",
        message: configResult.error.message,
      },
      stage: "normalize-options",
    });
  }

  const resolvedConfig = configResult.value;

  // Validate builder config exists
  if (!resolvedConfig.builder) {
    return err({
      type: "PluginError",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: "Builder configuration is missing in resolved config",
      cause: {
        code: "MISSING_BUILDER_CONFIG",
        message: "Builder configuration is missing in resolved config",
      },
      stage: "normalize-options",
    });
  }

  // Validate builder has required fields
  if (!resolvedConfig.builder.entry || resolvedConfig.builder.entry.length === 0) {
    return err({
      type: "PluginError",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: "Builder config must include non-empty entry array",
      cause: {
        code: "INVALID_BUILDER_CONFIG",
        message: "Builder config must include non-empty entry array",
      },
      stage: "normalize-options",
    });
  }

  return ok({
    importIdentifier,
    diagnostics,
    resolvedConfig,
    project,
    graphqlSystemPath: resolvedConfig.graphqlSystemPath,
  });
};

/**
 * Prepare plugin state by normalizing options and running builder.
 * This replaces the coordinator-based preparePluginState from plugin-shared.
 */
export const preparePluginState = async (rawOptions: Partial<PluginOptions>): Promise<Result<PluginState, PluginError>> => {
  // Normalize options
  const optionsResult = normalizePluginOptions(rawOptions);
  if (optionsResult.isErr()) {
    return err(optionsResult.error);
  }

  const options = optionsResult.value;

  // Create builder service
  const builderService = createBuilderService({ config: options.resolvedConfig });

  // Run builder to get artifacts
  const buildResult = builderService.build();
  if (buildResult.isErr()) {
    const builderError = buildResult.error;
    return err({
      type: "PluginError",
      code: "SODA_GQL_BUILDER_UNEXPECTED",
      message: `Builder failed: ${builderError.message}`,
      cause: builderError,
      stage: "builder",
    });
  }

  const artifact = buildResult.value;

  return ok({
    options,
    allArtifacts: artifact.elements,
  });
};
