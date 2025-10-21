/**
 * Builder bridge for plugin-babel.
 * Re-exports from @soda-gql/plugin-common with Babel-specific types.
 */

import { preparePluginState as preparePluginStateCommon, type PluginOptions, type PluginState } from "@soda-gql/plugin-common";

/**
 * Babel plugin options.
 */
export type BabelPluginOptions = PluginOptions;

export type { PluginState };

/**
 * Prepare plugin state for Babel plugin.
 */
export const preparePluginState = (options: BabelPluginOptions): PluginState | null => {
  return preparePluginStateCommon(options, "@soda-gql/plugin-babel");
};
