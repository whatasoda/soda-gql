import { defineSchemaFor } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import z from "zod";
import { type ConfigError, configError } from "./errors";
import type { SchemaConfig, SodaGqlConfig, StylesConfig } from "./types";

/**
 * Thin wrapper class to simplify the validation of exported value from config file.
 * As we use SWC + VM to execute the config file, the exported value is not typed.
 * This wrapper class ensures the exported value is a valid soda-gql config object.
 */
export class SodaGqlConfigContainer {
  private constructor(public readonly config: SodaGqlConfig) {}

  public static create(config: SodaGqlConfig): SodaGqlConfigContainer {
    return new SodaGqlConfigContainer(config);
  }
}

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
 *       scalars: "./scalars.ts",
 *     },
 *   },
 * }));
 * ```
 */
export function defineConfig(config: SodaGqlConfig): SodaGqlConfigContainer;
export function defineConfig(config: () => SodaGqlConfig): SodaGqlConfigContainer;
export function defineConfig(config: SodaGqlConfig | (() => SodaGqlConfig)): SodaGqlConfigContainer {
  const validated = validateConfig(typeof config === "function" ? config() : config);
  if (validated.isErr()) {
    throw validated.error;
  }
  return SodaGqlConfigContainer.create(validated.value);
}

const SchemaConfigSchema = defineSchemaFor<SchemaConfig>()({
  schema: z.string().min(1),
  scalars: z.string().min(1),
  helpers: z.string().min(1).optional(),
  metadata: z.string().min(1).optional(),
});

const StylesConfigSchema = defineSchemaFor<StylesConfig>()({
  importExtension: z.boolean().optional(),
});

const SodaGqlConfigSchema = defineSchemaFor<SodaGqlConfig>()({
  analyzer: z.enum(["ts", "swc"]).optional(),
  outdir: z.string().min(1),
  graphqlSystemAliases: z.array(z.string()).optional(),
  include: z.array(z.string().min(1)),
  exclude: z.array(z.string().min(1)).optional(),
  schemas: z.record(z.string(), SchemaConfigSchema),
  styles: StylesConfigSchema.optional(),
  plugins: z.record(z.string(), z.unknown()).optional(),
});

export function validateConfig(config: unknown): Result<SodaGqlConfig, ConfigError> {
  const result = SodaGqlConfigSchema.safeParse(config);

  if (!result.success) {
    return err(
      configError({
        code: "CONFIG_VALIDATION_FAILED",
        message: `Invalid config: ${result.error.message}`,
      }),
    );
  }

  return ok(result.data satisfies SodaGqlConfig);
}
