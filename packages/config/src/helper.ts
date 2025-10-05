import type { SodaGqlConfig } from "./types";

/**
 * Type-safe helper for defining soda-gql configuration.
 * Supports both static and dynamic (async) configs.
 *
 * @example Static config
 * import { defineConfig } from "@soda-gql/config";
 *
 * export default defineConfig({
 *   graphqlSystemPath: "./src/graphql-system/index.ts",
 *   builder: {
 *     entry: ["./src/**\/*.ts"],
 *     outDir: "./.cache",
 *   },
 * });
 *
 * @example Async config
 * export default defineConfig(async () => ({
 *   graphqlSystemPath: await resolveGraphqlSystem(),
 *   builder: { entry: ["./src/**\/*.ts"], outDir: "./.cache" },
 * }));
 */
export function defineConfig(
  config: SodaGqlConfig | (() => SodaGqlConfig) | (() => Promise<SodaGqlConfig>),
): SodaGqlConfig | (() => SodaGqlConfig) | (() => Promise<SodaGqlConfig>) {
  return config;
}

/**
 * Define multi-project workspace configuration.
 *
 * @example
 * export default defineWorkspace({
 *   defaultProject: "web",
 *   projects: {
 *     web: { graphqlSystemPath: "./apps/web/graphql-system" },
 *     mobile: { graphqlSystemPath: "./apps/mobile/graphql-system" },
 *   },
 * });
 */
export function defineWorkspace(config: SodaGqlConfig): SodaGqlConfig {
  return config;
}
