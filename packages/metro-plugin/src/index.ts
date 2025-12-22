import type { MetroConfig, MetroPluginOptions } from "./types";

// Re-export shared state utilities for advanced usage
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/plugin-common";
export type { MetroConfig, MetroPluginOptions, MetroTransformer, MetroTransformParams, MetroTransformResult } from "./types";

/**
 * Wrap Metro configuration with soda-gql support.
 *
 * This function modifies the Metro configuration to use the soda-gql
 * transformer, which applies GraphQL code transformations at build time.
 *
 * @example
 * ```typescript
 * // Expo project (metro.config.js)
 * const { getDefaultConfig } = require("expo/metro-config");
 * const { withSodaGql } = require("@soda-gql/metro-plugin");
 *
 * const config = getDefaultConfig(__dirname);
 * module.exports = withSodaGql(config);
 * ```
 *
 * @example
 * ```typescript
 * // React Native bare project (metro.config.js)
 * const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
 * const { withSodaGql } = require("@soda-gql/metro-plugin");
 *
 * const config = getDefaultConfig(__dirname);
 * module.exports = withSodaGql(config);
 * ```
 *
 * @example
 * ```typescript
 * // With options
 * const config = getDefaultConfig(__dirname);
 * module.exports = withSodaGql(config, {
 *   configPath: "./soda-gql.config.ts",
 *   debug: true,
 * });
 * ```
 *
 * @param config - The Metro configuration to wrap
 * @param _options - Optional plugin configuration (reserved for future use)
 * @returns Modified Metro configuration with soda-gql transformer
 */
export function withSodaGql<T extends MetroConfig>(config: T, _options: MetroPluginOptions = {}): T {
  const transformerPath = require.resolve("./transformer");

  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerPath,
    },
  } as T;
}
