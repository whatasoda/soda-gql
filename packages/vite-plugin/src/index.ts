// Re-export shared state utilities for advanced usage
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/plugin-common";
export { sodaGqlPlugin } from "./plugin";
export type { VitePluginOptions } from "./types";

// Convenience alias
export const withSodaGql = sodaGqlPlugin;
export default sodaGqlPlugin;
