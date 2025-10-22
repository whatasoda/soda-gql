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
  readonly artifact?: {
    readonly useBuilder: boolean;
    readonly path?: string;
  };
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
    console.error(`[${pluginName}] Failed to load config:`, {
      code: configResult.error.code,
      message: configResult.error.message,
      filePath: configResult.error.filePath,
      cause: configResult.error.cause,
    });
    return null;
  }


  const config = configResult.value;
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  /**
   * Build artifact on every invocation (like tsc-plugin).
   * If artifact.useBuilder is false and artifact.path is provided, load from file instead.
   * This ensures the artifact is always up-to-date with the latest source files.
   */
  const getArtifact = (): BuilderArtifact | null => {
    // If artifact path is provided and useBuilder is false, load from file
    if (options.artifact && !options.artifact.useBuilder && options.artifact.path) {
      try {
        const fs = require("node:fs");
        const artifactContent = fs.readFileSync(options.artifact.path, "utf-8");
        return JSON.parse(artifactContent) as BuilderArtifact;
      } catch (error) {
        console.error(`[${pluginName}] Failed to load artifact from ${options.artifact.path}:`, error);
        return null;
      }
    }

    // Otherwise, build artifact using builder service
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
