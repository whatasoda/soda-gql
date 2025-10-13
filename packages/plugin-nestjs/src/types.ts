// Re-export config types
export type { SodaGqlConfig } from "./schemas/config.js";

// Re-export webpack schema-derived types
export type {
  DiagnosticsMode as WebpackDiagnosticsMode,
  WebpackLoaderOptions,
  WebpackPluginOptions,
} from "./schemas/webpack.js";
