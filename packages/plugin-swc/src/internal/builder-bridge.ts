/**
 * Builder bridge for plugin-swc.
 * Simplified to match tsc-plugin pattern with direct builder invocation.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { loadConfig, type ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * SWC plugin options.
 */
export type SwcPluginOptions = {
  readonly configPath?: string;
  readonly enabled?: boolean;
  readonly importIdentifier?: string;
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
  readonly importIdentifier: string;
};

/**
 * Prepare plugin state by loading config and creating cached builder service.
 * Returns null if disabled or config load fails.
 */
export const preparePluginState = (options: SwcPluginOptions): PluginState | null => {
  const enabled = options.enabled ?? true;
  if (!enabled) {
    return null;
  }

  const configPath = options.configPath ?? "./soda-gql.config.ts";
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    console.error(`[@soda-gql/plugin-swc] Failed to load config: ${configResult.error.message}`);
    return null;
  }

  const config = configResult.value;
  const importIdentifier = options.importIdentifier ?? config.graphqlSystemAliases[0] ?? "@/graphql-system";

  // Support test mode where artifact is loaded from file instead of built
  const useBuilder = options.artifact?.useBuilder ?? true;
  const artifactPath = options.artifact?.path;

  if (!useBuilder && artifactPath) {
    // Test mode: Load artifact from file
    const getArtifact = (): BuilderArtifact | null => {
      try {
        const fs = require("node:fs");
        const artifactJson = fs.readFileSync(artifactPath, "utf-8");
        return JSON.parse(artifactJson) as BuilderArtifact;
      } catch (error) {
        console.error(`[@soda-gql/plugin-swc] Failed to load artifact from ${artifactPath}:`, error);
        return null;
      }
    };

    return {
      config,
      ensureBuilderService: () => {
        throw new Error("Builder service not available in test mode with preloaded artifact");
      },
      getArtifact,
      importIdentifier,
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
      console.error(`[@soda-gql/plugin-swc] Failed to build artifact: ${buildResult.error.message}`);
      return null;
    }
    return buildResult.value;
  };

  return {
    config,
    ensureBuilderService,
    getArtifact,
    importIdentifier,
  };
};
