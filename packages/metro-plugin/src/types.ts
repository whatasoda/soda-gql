import type { PluginOptions } from "@soda-gql/plugin-common";

/**
 * Options for the Metro plugin configuration wrapper.
 */
export type MetroPluginOptions = PluginOptions & {
  /** Enable verbose logging for debugging */
  readonly debug?: boolean;
};
