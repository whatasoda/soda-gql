import { resolve } from "node:path";
import type { BuilderServiceConfig } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import type { PluginOptions } from "./types";

export type NormalizedOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly importIdentifier: string;
  readonly diagnostics: "json" | "console";
  readonly resolvedConfig: ResolvedSodaGqlConfig;
  readonly artifact:
    | { readonly type: "builder"; readonly config: BuilderServiceConfig }
    | { readonly type: "artifact-file"; readonly path: string };
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
      readonly code: "PROJECT_NOT_FOUND";
      readonly message: string;
      readonly project: string;
    }
  | {
      readonly type: "OptionsError";
      readonly code: "INVALID_ARTIFACT_OVERRIDE";
      readonly message: string;
    }
  | {
      readonly type: "OptionsError";
      readonly code: "MISSING_BUILDER_CONFIG";
      readonly message: string;
    };

/**
 * New normalize function that handles config discovery
 */
export const normalizePluginOptions = async (raw: Partial<PluginOptions>): Promise<Result<NormalizedOptions, OptionsError>> => {
  // Extract basic options with defaults
  const mode = raw.mode ?? "runtime";
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const diagnostics = raw.diagnostics ?? "json";

  // Handle artifact override
  const artifactOverride = raw.artifact;
  const useBuilder = artifactOverride?.useBuilder ?? true;

  if (!useBuilder) {
    // File-based artifact mode
    if (!artifactOverride?.path) {
      return err({
        type: "OptionsError",
        code: "MISSING_ARTIFACT_PATH",
        message: "artifact.path is required when useBuilder is false",
      });
    }

    // For file mode, we still need to load config for other settings
    // but we won't use the builder
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

    return ok({
      mode,
      importIdentifier,
      diagnostics,
      resolvedConfig: configResult.value,
      artifact: {
        type: "artifact-file",
        path: resolve(artifactOverride.path),
      },
    });
  }

  // Builder mode (default)
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
    mode,
    importIdentifier,
    diagnostics,
    resolvedConfig,
    artifact: {
      type: "builder",
      config: builderServiceConfig,
    },
  });
};
