import { getStateKey, setSharedTransformerType } from "@soda-gql/builder/plugin-support";
import type { MetroConfig, MetroPluginOptions, SodaGqlTransformerOptions } from "./types";

// Re-export shared state utilities for advanced usage
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/builder/plugin-support";
export type {
  MetroConfig,
  MetroPluginOptions,
  MetroTransformer,
  MetroTransformParams,
  MetroTransformResult,
  SodaGqlTransformerOptions,
  TransformerType,
} from "./types";

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
 * @param options - Optional plugin configuration
 * @returns Modified Metro configuration with soda-gql transformer
 */
export function withSodaGql<T extends MetroConfig>(config: T, options: MetroPluginOptions = {}): T {
  // Use package export path to ensure correct resolution from any location
  const transformerPath = require.resolve("@soda-gql/metro-plugin/transformer");

  // Store transformer type in shared state for the transformer module to read
  const stateKey = getStateKey(options.configPath);
  if (options.transformer) {
    setSharedTransformerType(stateKey, options.transformer);
  }

  // Determine upstream transformer path:
  // 1. Explicit option takes precedence
  // 2. Fall back to existing babelTransformerPath from config (auto-detect)
  const upstreamTransformer = options.upstreamTransformer ?? config.transformer?.babelTransformerPath;

  // Build sodaGqlTransformerOptions to pass to the transformer
  const sodaGqlTransformerOptions: SodaGqlTransformerOptions = {
    ...(upstreamTransformer && { upstreamTransformer }),
    ...(options.configPath && { configPath: options.configPath }),
    ...(options.transformer && { transformerType: options.transformer }),
  };

  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerPath,
      // Pass options to transformer via Metro config
      ...(Object.keys(sodaGqlTransformerOptions).length > 0 && { sodaGqlTransformerOptions }),
    },
  } as T;
}
