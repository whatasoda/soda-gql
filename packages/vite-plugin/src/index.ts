// Re-export shared state utilities for advanced usage
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/plugin-common";
export { sodaGqlPlugin } from "./plugin";
export type { VitePluginOptions } from "./types";

// Re-import for convenience aliases
import { sodaGqlPlugin as _sodaGqlPlugin } from "./plugin";

/**
 * Convenience alias for sodaGqlPlugin.
 * @see {@link sodaGqlPlugin}
 */
export const withSodaGql = _sodaGqlPlugin;

export default _sodaGqlPlugin;
