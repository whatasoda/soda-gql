/**
 * Plugin session management for all plugins.
 * Unified from plugin-babel and plugin-swc implementations.
 */

import type { BuilderArtifact, BuilderService } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import { getSharedBuilderService, getStateKey, setSharedBuilderService } from "./shared-state";

/**
 * Plugin options shared across all plugins.
 */
export type PluginOptions = {
  readonly configPath?: string;
  readonly enabled?: boolean;
};

/**
 * Plugin session containing builder service and configuration.
 */
export type PluginSession = {
  readonly config: ResolvedSodaGqlConfig;
  readonly getArtifact: () => BuilderArtifact | null;
  readonly getArtifactAsync: () => Promise<BuilderArtifact | null>;
};

/**
 * Create plugin session by loading config and creating cached builder service.
 * Returns null if disabled or config load fails.
 */
export const createPluginSession = (options: PluginOptions, pluginName: string): PluginSession | null => {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    return null;
  }

  const configResult = loadConfig(options.configPath);
  if (configResult.isErr()) {
    console.error(`[${pluginName}] Failed to load config:`, {
      code: configResult.error.code,
      message: configResult.error.message,
      filePath: configResult.error.filePath,
      cause: configResult.error.cause,
    });
    return null;
  }

  const config = configResult.value;
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
   * If artifact.useBuilder is false and artifact.path is provided, load from file instead.
   * This ensures the artifact is always up-to-date with the latest source files.
   */
  const getArtifact = (): BuilderArtifact | null => {
    const builderService = ensureBuilderService();
    const buildResult = builderService.build();
    if (buildResult.isErr()) {
      console.error(`[${pluginName}] Failed to build artifact: ${buildResult.error.message}`);
      return null;
    }
    return buildResult.value;
  };

  /**
   * Async version of getArtifact.
   * Supports async metadata factories and parallel element evaluation.
   */
  const getArtifactAsync = async (): Promise<BuilderArtifact | null> => {
    const builderService = ensureBuilderService();
    const buildResult = await builderService.buildAsync();
    if (buildResult.isErr()) {
      console.error(`[${pluginName}] Failed to build artifact: ${buildResult.error.message}`);
      return null;
    }
    return buildResult.value;
  };

  return {
    config,
    getArtifact,
    getArtifactAsync,
  };
};
