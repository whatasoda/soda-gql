// Re-export shared plugin types
export type {
  ArtifactSource,
  BuilderConfig,
  SodaGqlPluginOptions,
} from "@soda-gql/plugin-shared";
export type { SodaGqlConfig } from "./schemas/config.js";

export type {
  DiagnosticsMode as NestDiagnosticsMode,
  NestModuleOptions,
} from "./schemas/module.js";
// Re-export schema-derived types
export type {
  DiagnosticsMode as WebpackDiagnosticsMode,
  WebpackLoaderOptions,
  WebpackPluginOptions,
} from "./schemas/webpack.js";
