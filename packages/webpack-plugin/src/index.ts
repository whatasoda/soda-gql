// Re-export shared state utilities from builder/plugin for convenience
export {
  getSharedArtifact,
  getSharedBuilderService,
  getSharedPluginSession,
  getSharedState,
  getStateKey,
  setSharedBuilderService,
  setSharedPluginSession,
} from "@soda-gql/builder/plugin";
export { SodaGqlWebpackPlugin } from "./plugin";
export type { TransformerType, WebpackLoaderOptions, WebpackPluginOptions } from "./types";
