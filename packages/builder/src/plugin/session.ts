/**
 * Plugin session management for all plugins.
 * Unified from plugin-babel and plugin-swc implementations.
 */

import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { loadArtifactSync } from "../artifact/loader";
import type { BuilderArtifact } from "../artifact/types";
import { formatBuilderErrorForCLI } from "../errors/formatter";
import type { BuilderService } from "../service";
import { createBuilderService } from "../service";
import { getSharedBuilderService, getStateKey, setSharedBuilderService } from "./shared-state";

/**
 * Plugin options shared across all plugins.
 */
export type PluginOptions = {
  readonly configPath?: string;
  readonly enabled?: boolean;
  /**
   * Whether to fail the build on error.
   * When true (default), throws an error that fails the bundler build.
   * When false, logs the error and continues (graceful degradation).
   */
  readonly failOnError?: boolean;
};

/**
 * Plugin session containing builder service and configuration.
 */
export type PluginSession = {
  readonly config: ResolvedSodaGqlConfig;
  readonly getArtifact: () => BuilderArtifact | null;
  readonly getArtifactAsync: () => Promise<BuilderArtifact | null>;
  /**
   * Whether the session is using a pre-built artifact.
   * When true, artifacts are loaded from a file instead of built dynamically.
   */
  readonly isPrebuiltMode: boolean;
};

/**
 * Create plugin session by loading config and creating cached builder service.
 * Returns null if disabled or config load fails.
 *
 * @param options - Plugin options
 * @param pluginName - Name of the plugin for error messages
 * @throws Error if failOnError is true and config load fails
 */
export const createPluginSession = (options: PluginOptions, pluginName: string): PluginSession | null => {
  const enabled = options.enabled ?? true;
  const failOnError = options.failOnError ?? true;

  if (!enabled) {
    return null;
  }

  const configResult = loadConfig(options.configPath);
  if (configResult.isErr()) {
    const errorMsg = `[${pluginName}] Failed to load config: ${configResult.error.message}`;
    console.error(errorMsg, {
      code: configResult.error.code,
      filePath: configResult.error.filePath,
      cause: configResult.error.cause,
    });
    if (failOnError) {
      throw new Error(errorMsg);
    }
    return null;
  }

  const config = configResult.value;

  // Check if pre-built artifact mode is enabled
  if (config.artifact?.path) {
    const artifactResult = loadArtifactSync(config.artifact.path);

    if (artifactResult.isErr()) {
      const errorMsg = `[${pluginName}] Failed to load pre-built artifact: ${artifactResult.error.message}`;
      console.error(errorMsg, {
        code: artifactResult.error.code,
        filePath: artifactResult.error.filePath,
      });
      if (failOnError) {
        throw new Error(errorMsg);
      }
      return null;
    }

    const prebuiltArtifact = artifactResult.value;
    console.log(`[${pluginName}] Using pre-built artifact: ${config.artifact.path}`);

    return {
      config,
      getArtifact: () => prebuiltArtifact,
      getArtifactAsync: async () => prebuiltArtifact,
      isPrebuiltMode: true,
    };
  }

  // Dynamic build mode
  const stateKey = getStateKey(options.configPath);

  // Use global BuilderService cache to share FileTracker state across plugin instances
  const ensureBuilderService = (): BuilderService => {
    const existing = getSharedBuilderService(stateKey);
    if (existing) {
      return existing;
    }

    const service = createBuilderService({ config });
    setSharedBuilderService(stateKey, service);
    return service;
  };

  /**
   * Build artifact on every invocation (like tsc-plugin).
   * This ensures the artifact is always up-to-date with the latest source files.
   *
   * @throws Error if failOnError is true and build fails
   */
  const getArtifact = (): BuilderArtifact | null => {
    const builderService = ensureBuilderService();
    const buildResult = builderService.build();
    if (buildResult.isErr()) {
      const formattedError = formatBuilderErrorForCLI(buildResult.error);
      console.error(`[${pluginName}] Build failed:\n${formattedError}`);
      if (failOnError) {
        throw new Error(`[${pluginName}] ${buildResult.error.message}`);
      }
      return null;
    }
    return buildResult.value;
  };

  /**
   * Async version of getArtifact.
   * Supports async metadata factories and parallel element evaluation.
   *
   * @throws Error if failOnError is true and build fails
   */
  const getArtifactAsync = async (): Promise<BuilderArtifact | null> => {
    const builderService = ensureBuilderService();
    const buildResult = await builderService.buildAsync();
    if (buildResult.isErr()) {
      const formattedError = formatBuilderErrorForCLI(buildResult.error);
      console.error(`[${pluginName}] Build failed:\n${formattedError}`);
      if (failOnError) {
        throw new Error(`[${pluginName}] ${buildResult.error.message}`);
      }
      return null;
    }
    return buildResult.value;
  };

  return {
    config,
    getArtifact,
    getArtifactAsync,
    isPrebuiltMode: false,
  };
};
