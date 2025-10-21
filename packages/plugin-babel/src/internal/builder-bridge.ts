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
};

/**
 * Plugin state containing builder service and configuration.
 */
export type PluginState = {
  readonly config: ResolvedSodaGqlConfig;
  readonly artifact: BuilderArtifact;
  readonly ensureBuilderService: () => ReturnType<typeof createBuilderService>;
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
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  // Initial build to get artifact
  const builderService = ensureBuilderService();
  const buildResult = builderService.build();
  if (buildResult.isErr()) {
    console.error(`[@soda-gql/plugin-babel] Failed to build initial artifact: ${buildResult.error.message}`);
    return null;
  }

  const artifact = buildResult.value;

  return {
    config,
    artifact,
    ensureBuilderService,
  };
};
