// Re-export shared state utilities from plugin-common for convenience
export { getSharedArtifact, getSharedState, getStateKey } from "@soda-gql/plugin-common";
export { SodaGqlWebpackPlugin } from "./plugin";
export type { TransformerType, WebpackLoaderOptions, WebpackPluginOptions } from "./types";
