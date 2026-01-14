import { getStateKey, setSharedTransformerType } from "@soda-gql/builder/plugin-support";
import type { MetroConfig, MetroPluginOptions } from "./types";

// Re-export shared state utilities for advanced usage
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/builder/plugin-support";
export type {
  MetroConfig,
  MetroPluginOptions,
  MetroTransformer,
  MetroTransformParams,
  MetroTransformResult,
  TransformerType,
} from "./types";

/**
 * Wrap Metro configuration with soda-gql support.
 *
 * This function modifies the Metro configuration to use the soda-gql
 * transformer, which applies GraphQL code transformations at build time.
 *
 * If the config already has a custom `babelTransformerPath` set (e.g., from
 * react-native-svg-transformer), soda-gql will automatically chain with it.
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
 * // Chaining with another transformer (e.g., react-native-svg-transformer)
 * // The existing babelTransformerPath is automatically detected and chained.
 * const { getDefaultConfig } = require("expo/metro-config");
 * const { withSodaGql } = require("@soda-gql/metro-plugin");
 *
 * const config = getDefaultConfig(__dirname);
 * config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");
 * module.exports = withSodaGql(config);
 * ```
 *
 * @example
 * ```typescript
 * // Explicitly specifying upstream transformer
 * const config = getDefaultConfig(__dirname);
 * module.exports = withSodaGql(config, {
 *   upstreamTransformer: require.resolve("react-native-svg-transformer"),
 * });
 * ```
 *
 * @param config - The Metro configuration to wrap
 * @param options - Optional plugin configuration
 * @returns Modified Metro configuration with soda-gql transformer
 */
export function withSodaGql<T extends MetroConfig>(config: T, options: MetroPluginOptions = {}): T {
  // Store transformer type in shared state for the transformer module to read
  const stateKey = getStateKey(options.configPath);
  if (options.transformer) {
    setSharedTransformerType(stateKey, options.transformer);
  }

  // Use package export path to ensure correct resolution from any location
  const transformerPath = require.resolve("@soda-gql/metro-plugin/transformer");

  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerPath,
    },
  } as T;
}
