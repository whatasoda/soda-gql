import type { PluginOptions } from "@soda-gql/plugin-common";

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
};
