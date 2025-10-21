import type { SodaGqlConfig } from "./types";

/**
 * Type-safe helper for defining soda-gql configuration.
 * Supports both static and dynamic (async) configs.
 *
 * @example Static config
 * ```ts
 * import { defineConfig } from "@soda-gql/config";
 *
 * export default defineConfig({
 *   outdir: "./graphql-system",
 *   include: ["./src/**\/*.ts"],
 *   schemas: {
 *     default: {
 *       schema: "./schema.graphql",
 *       runtimeAdapter: "./runtime-adapter.ts",
 *       scalars: "./scalars.ts",
 *     },
 *   },
 * });
 * ```
 *
 * @example Async config
 * ```ts
 * export default defineConfig(async () => ({
 *   outdir: await resolveOutputDir(),
 *   include: ["./src/**\/*.ts"],
 *   schemas: {
 *     default: {
 *       schema: "./schema.graphql",
 *       runtimeAdapter: "./runtime-adapter.ts",
 *       scalars: "./scalars.ts",
 *     },
 *   },
 * }));
 * ```
 */
export function defineConfig(config: SodaGqlConfig): SodaGqlConfig;
export function defineConfig(config: () => SodaGqlConfig): SodaGqlConfig;
export function defineConfig(config: () => Promise<SodaGqlConfig>): Promise<SodaGqlConfig>;
export function defineConfig(
  config: SodaGqlConfig | (() => SodaGqlConfig) | (() => Promise<SodaGqlConfig>),
): SodaGqlConfig | Promise<SodaGqlConfig> {
  return typeof config === "function" ? config() : config;
}
