// Re-export config types

// Re-export webpack schema-derived types
export type {
  DiagnosticsMode as WebpackDiagnosticsMode,
  WebpackLoaderOptions,
  WebpackPluginOptions,
} from "@soda-gql/plugin-webpack";
export type { SodaGqlConfig } from "./schemas/config.js";
