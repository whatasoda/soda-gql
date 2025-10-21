/**
 * Builder bridge for plugin-swc.
 * Re-exports from @soda-gql/plugin-common with SWC-specific types.
 */

import { preparePluginState as preparePluginStateCommon, type PluginOptions, type PluginState } from "@soda-gql/plugin-common";

/**
 * SWC plugin options.
 */
export type SwcPluginOptions = PluginOptions;

export type { PluginState };

/**
 * Prepare plugin state for SWC plugin.
 */
export const preparePluginState = (options: SwcPluginOptions): PluginState | null => {
  return preparePluginStateCommon(options, "@soda-gql/plugin-swc");
};
