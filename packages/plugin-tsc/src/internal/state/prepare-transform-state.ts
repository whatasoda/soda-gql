/**
 * Transform state preparation for TypeScript compiler plugin.
 *
 * This module manages builder service instances with caching to optimize
 * repeated transformer invocations.
 */

import type { BuilderArtifactElement, BuilderServiceConfig, CanonicalId } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import type { PluginError } from "../errors.js";

/**
 * Plugin options for state preparation.
 */
export type PluginOptions = {
  readonly importIdentifier?: string;
  readonly configPath?: string;
  readonly project?: string;
};

/**
 * Normalized plugin options after validation and config resolution.
 */
export type NormalizedOptions = {
  readonly importIdentifier: string;
  readonly resolvedConfig: ResolvedSodaGqlConfig;
  readonly builderConfig: BuilderServiceConfig;
  readonly project?: string;
  readonly graphqlSystemPath?: string;
};

/**
 * Configuration for transform state preparation.
 */
export type PrepareTransformStateArgs = {
  readonly configPath?: string;
  readonly project?: string;
  readonly importIdentifier?: string;
  readonly packageLabel?: string;
};

/**
 * Prepared state for transformation.
 */
export type PreparedTransformState = {
  readonly importIdentifier: string;
  readonly allArtifacts: Record<CanonicalId, BuilderArtifactElement>;
  readonly graphqlSystemPath?: string;
  readonly release: () => void;
};

/**
 * Errors that can occur during state preparation.
 */
export type PrepareTransformStateError =
  | { readonly type: "PLUGIN_ERROR"; readonly error: PluginError };

/**
 * Cache entry with builder service instance.
 */
interface CacheEntry {
  builderService: ReturnType<typeof createBuilderService>;
  options: NormalizedOptions;
}

// Module-level cache keyed by config parameters
const stateCache = new Map<string, CacheEntry>();

/**
 * Create a cache key from preparation args.
 */
const createCacheKey = (args: PrepareTransformStateArgs): string => {
  const { configPath = "", project = "", importIdentifier = "@/graphql-system" } = args;
  return JSON.stringify({ configPath, project, importIdentifier });
};

/**
 * Normalize plugin options and resolve configuration.
 */
const normalizeOptions = (raw: PluginOptions): Result<NormalizedOptions, PluginError> => {
  const importIdentifier = raw.importIdentifier ?? "@/graphql-system";
  const project = raw.project;

  // Load config synchronously
  const configResult = loadConfig(raw.configPath);
  if (configResult.isErr()) {
    return err({
      type: "PluginError",
      stage: "normalize-options",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: `Failed to load config: ${configResult.error.message}`,
      cause: {
        code: "CONFIG_LOAD_FAILED",
        message: configResult.error.message,
      },
    });
  }

  const resolvedConfig = configResult.value;

  // Validate builder config exists
  if (!resolvedConfig.builder) {
    return err({
      type: "PluginError",
      stage: "normalize-options",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: "Builder configuration is missing in resolved config",
      cause: {
        code: "MISSING_BUILDER_CONFIG",
        message: "Builder configuration is missing",
      },
    });
  }

  // Validate builder has required fields
  if (!resolvedConfig.builder.entry || resolvedConfig.builder.entry.length === 0) {
    return err({
      type: "PluginError",
      stage: "normalize-options",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: "Builder config must include non-empty entry array",
      cause: {
        code: "INVALID_BUILDER_CONFIG",
        message: "Builder config must include non-empty entry array",
      },
    });
  }

  if (!resolvedConfig.builder.analyzer) {
    return err({
      type: "PluginError",
      stage: "normalize-options",
      code: "OPTIONS_INVALID_BUILDER_CONFIG",
      message: "Builder config must include analyzer",
      cause: {
        code: "INVALID_BUILDER_CONFIG",
        message: "Builder config must include analyzer",
      },
    });
  }

  // Create BuilderServiceConfig
  const builderServiceConfig: BuilderServiceConfig = {
    config: resolvedConfig,
    entrypoints: resolvedConfig.builder.entry,
  };

  return ok({
    importIdentifier,
    resolvedConfig,
    builderConfig: builderServiceConfig,
    project,
    graphqlSystemPath: resolvedConfig.graphqlSystemPath,
  });
};

/**
 * Prepare transformation state using the builder service.
 *
 * This function:
 * 1. Normalizes options and creates/retrieves a builder service instance
 * 2. Calls build() to generate the latest artifacts
 * 3. Caches the service for reuse across transformer invocations
 * 4. Returns prepared state with artifact lookup and cleanup function
 *
 * @param args - Configuration for preparation
 * @returns Result containing prepared state or error
 */
export function prepareTransformState(
  args: PrepareTransformStateArgs,
): Result<PreparedTransformState, PrepareTransformStateError> {
  const cacheKey = createCacheKey(args);

  try {
    // Check cache first
    let cached = stateCache.get(cacheKey);

    if (!cached) {
      // Normalize options
      const optionsResult = normalizeOptions({
        configPath: args.configPath,
        project: args.project,
        importIdentifier: args.importIdentifier,
      });

      if (optionsResult.isErr()) {
        return err({
          type: "PLUGIN_ERROR",
          error: optionsResult.error,
        });
      }

      const options = optionsResult.value;

      // Create builder service
      const builderService = createBuilderService(options.builderConfig);

      cached = {
        builderService,
        options,
      };

      stateCache.set(cacheKey, cached);
    }

    // Build artifacts synchronously
    const buildResult = cached.builderService.build({ force: false });

    if (buildResult.isErr()) {
      // Map builder errors to plugin errors
      const builderError = buildResult.error;
      return err({
        type: "PLUGIN_ERROR",
        error: {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_UNEXPECTED",
          message: `Builder error: ${builderError.message}`,
          cause: builderError,
        },
      });
    }

    const artifact = buildResult.value;

    return ok({
      importIdentifier: cached.options.importIdentifier,
      allArtifacts: artifact.elements,
      graphqlSystemPath: cached.options.graphqlSystemPath,
      release: () => {
        // Release is typically called when the transformer is done
        // For now, we keep the cache alive for reuse
        // Actual cleanup happens in clearPrepareSyncCache
      },
    });
  } catch (error) {
    return err({
      type: "PLUGIN_ERROR",
      error: {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_UNEXPECTED",
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      },
    });
  }
}

/**
 * Clear the preparation cache and release all services.
 * This should be called when the compiler process ends or in tests.
 */
export function clearPrepareSyncCache(): void {
  stateCache.clear();
}
