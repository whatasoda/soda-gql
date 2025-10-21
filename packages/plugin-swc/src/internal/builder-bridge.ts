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
};

/**
 * Plugin state containing builder service and configuration.
 */
export type PluginState = {
  readonly config: ResolvedSodaGqlConfig;
  readonly artifact: BuilderArtifact;
  readonly ensureBuilderService: () => ReturnType<typeof createBuilderService>;
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
  const ensureBuilderService = cachedFn(() => createBuilderService({ config }));

  // Initial build to get artifact
  const builderService = ensureBuilderService();
  const buildResult = builderService.build();
  if (buildResult.isErr()) {
    console.error(`[@soda-gql/plugin-swc] Failed to build initial artifact: ${buildResult.error.message}`);
    return null;
  }

  const artifact = buildResult.value;
  const importIdentifier = options.importIdentifier ?? config.graphqlSystemAliases[0] ?? "@/graphql-system";

  return {
    config,
    artifact,
    ensureBuilderService,
    importIdentifier,
  };
};
