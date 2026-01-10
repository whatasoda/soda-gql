import type { PluginOptions, TransformerType } from "@soda-gql/builder/plugin";

export type { TransformerType } from "@soda-gql/builder/plugin";

/**
 * Options for the Vite plugin.
 */
export type VitePluginOptions = PluginOptions & {
  /** File patterns to include for transformation (defaults to config.include) */
  readonly include?: RegExp | RegExp[];
  /** File patterns to exclude from transformation */
  readonly exclude?: RegExp | RegExp[];
  /** Enable verbose logging for debugging */
  readonly debug?: boolean;
  /**
   * Transformer to use for code transformation.
   * @default 'babel'
   */
  readonly transformer?: TransformerType;
};
