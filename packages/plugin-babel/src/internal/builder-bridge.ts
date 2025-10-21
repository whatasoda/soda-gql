/**
 * Builder bridge for plugin-babel.
 * Simplified to match tsc-plugin pattern with direct builder invocation.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * Babel plugin options.
 */
export type BabelPluginOptions = {
  readonly configPath?: string;
  readonly enabled?: boolean;
  /**
   * Artifact configuration.
   * If useBuilder is false, artifact will be loaded from the specified path.
   * If useBuilder is true or not specified, artifact will be built from source files.
   */
  readonly artifact?: {
    readonly useBuilder?: boolean;
    readonly path?: string;
  };
};

/**
 * Plugin state containing builder service and configuration.
 */
export type PluginState = {
  readonly config: ResolvedSodaGqlConfig;
  readonly ensureBuilderService: () => ReturnType<typeof createBuilderService>;
  readonly getArtifact: () => BuilderArtifact | null;
};

/**
 * Prepare plugin state by loading config and creating cached builder service.
 * Returns null if disabled or config load fails.
 */
export const preparePluginState = (options: BabelPluginOptions): PluginState | null => {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    return null;
  }

  const configPath = options.configPath ?? "./soda-gql.config.ts";
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error(`[@soda-gql/plugin-babel] Failed to load config: ${configResult.error.message}`);
    return null;
  }

  const config = configResult.value;

  // Support test mode where artifact is loaded from file instead of built
  const useBuilder = options.artifact?.useBuilder ?? true;
  const artifactPath = options.artifact?.path;

  if (!useBuilder && artifactPath) {
    // Test mode: Load artifact from file
    const getArtifact = (): BuilderArtifact | null => {
      try {
        const fs = require("node:fs");
        const artifactJson = fs.readFileSync(artifactPath, "utf-8");
        const artifact = JSON.parse(artifactJson) as BuilderArtifact;
        return artifact;
      } catch (error) {
        console.error(`[@soda-gql/plugin-babel] Failed to load artifact from ${artifactPath}:`, error);
        return null;
      }
    };

    return {
      config,
      ensureBuilderService: () => {
        throw new Error("Builder service not available in test mode with preloaded artifact");
      },
      getArtifact,
    };
  }

  // Normal mode: Build artifact from source files
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  /**
   * Build artifact on every invocation (like tsc-plugin).
   * This ensures the artifact is always up-to-date with the latest source files.
   */
  const getArtifact = (): BuilderArtifact | null => {
    const builderService = ensureBuilderService();
    const buildResult = builderService.build();
    if (buildResult.isErr()) {
      console.error(`[@soda-gql/plugin-babel] Failed to build artifact: ${buildResult.error.message}`);
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
