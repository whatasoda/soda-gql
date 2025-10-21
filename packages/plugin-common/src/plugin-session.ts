/**
 * Plugin session management for all plugins.
 * Unified from plugin-babel and plugin-swc implementations.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";

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
  readonly ensureBuilderService: () => ReturnType<typeof createBuilderService>;
  readonly getArtifact: () => BuilderArtifact | null;
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
    console.error(`[${pluginName}] Failed to load config: ${configResult.error.message}`);
    return null;
  }

  const config = configResult.value;
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  /**
   * Build artifact on every invocation (like tsc-plugin).
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

  return {
    config,
    ensureBuilderService,
    getArtifact,
  };
};
