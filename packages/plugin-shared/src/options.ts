import type { BuilderServiceConfig } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import type { PluginOptions } from "./types.js";

/**
 * Normalized plugin options after validation and config resolution.
 * Always uses builder - no file-based artifact support.
 */
export type NormalizedOptions = {
  readonly importIdentifier: string;
  readonly diagnostics: "json" | "console";
  readonly resolvedConfig: ResolvedSodaGqlConfig;
  readonly builderConfig: BuilderServiceConfig;
  readonly project?: string;
};

export type OptionsError =
  | {
      readonly type: "OptionsError";
      readonly code: "INVALID_BUILDER_CONFIG";
      readonly message: string;
    }
  | {
      readonly type: "OptionsError";
      readonly code: "CONFIG_LOAD_FAILED";
      readonly message: string;
      readonly configPath?: string;
      readonly cause?: unknown;
    }
  | {
      readonly type: "OptionsError";
      readonly code: "MISSING_BUILDER_CONFIG";
      readonly message: string;
    };

/**
 * Normalize plugin options and resolve configuration.
 * Always uses builder for artifact generation - no file-based mode.
 */
export const normalizePluginOptions = async (
  raw: Partial<PluginOptions>,
): Promise<Result<NormalizedOptions, OptionsError>> => {
  // Extract basic options with defaults
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";
  const project = raw.project;

  // Load config
  const configResult = await loadConfig(raw.configPath);
  if (configResult.isErr()) {
    return err({
      type: "OptionsError",
      code: "CONFIG_LOAD_FAILED",
      message: `Failed to load config: ${configResult.error.message}`,
      configPath: raw.configPath,
      cause: configResult.error,
    });
  }

  const resolvedConfig = configResult.value;

  // Validate builder config exists
  if (!resolvedConfig.builder) {
    return err({
      type: "OptionsError",
      code: "MISSING_BUILDER_CONFIG",
      message: "Builder configuration is missing in resolved config",
    });
  }

  // Validate builder has required fields
  if (!resolvedConfig.builder.entry || resolvedConfig.builder.entry.length === 0) {
    return err({
      type: "OptionsError",
      code: "INVALID_BUILDER_CONFIG",
      message: "Builder config must include non-empty entry array",
    });
  }

  if (!resolvedConfig.builder.analyzer) {
    return err({
      type: "OptionsError",
      code: "INVALID_BUILDER_CONFIG",
      message: "Builder config must include analyzer",
    });
  }

  // Create BuilderServiceConfig
  const builderServiceConfig: BuilderServiceConfig = {
    config: resolvedConfig,
    entrypoints: resolvedConfig.builder.entry,
  };

  return ok({
    importIdentifier,
    diagnostics,
    resolvedConfig,
    builderConfig: builderServiceConfig,
    project,
  });
};
