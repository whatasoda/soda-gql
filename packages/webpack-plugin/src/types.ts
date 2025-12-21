import type { PluginOptions } from "@soda-gql/plugin-common";

/**
 * Options for the SodaGqlWebpackPlugin.
 */
export type WebpackPluginOptions = PluginOptions & {
  /**
   * File patterns to include for transformation.
   * Defaults to files matching config.include patterns.
   */
  readonly include?: RegExp | RegExp[];

  /**
   * File patterns to exclude from transformation.
   */
  readonly exclude?: RegExp | RegExp[];

  /**
   * Enable verbose logging for debugging.
   */
  readonly debug?: boolean;
};

/**
 * Options for the webpack loader.
 */
export type WebpackLoaderOptions = {
  /**
   * Path to soda-gql config file.
   */
  readonly configPath?: string;

  /**
   * Enable/disable the loader.
   */
  readonly enabled?: boolean;
};
