import type { PluginOptions } from "@soda-gql/builder/plugin";

/**
 * Transformer type for code transformation.
 * - 'babel': Use Babel plugin (default, wider compatibility)
 * - 'swc': Use SWC transformer (faster, requires @soda-gql/swc)
 */
export type TransformerType = "babel" | "swc";

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

  /**
   * Transformer to use for code transformation.
   * @default 'babel'
   */
  readonly transformer?: TransformerType;
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

  /**
   * Transformer to use for code transformation.
   * @default 'babel'
   */
  readonly transformer?: TransformerType;
};
