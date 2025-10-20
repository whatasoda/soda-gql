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
export function defineConfig(config: SodaGqlConfig | (() => SodaGqlConfig)): SodaGqlConfig {
  return typeof config === "function" ? config() : config;
}
