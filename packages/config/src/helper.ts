import z from "zod";
import type { SchemaConfig, SodaGqlConfig } from "./types";
import { err, ok, Result } from "neverthrow";
import { configError, ConfigError } from "./errors";
import { defineSchemaFor } from "@soda-gql/common";

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
export function defineConfig(config: SodaGqlConfig): SodaGqlConfigContainer;
export function defineConfig(config: () => SodaGqlConfig): SodaGqlConfigContainer;
export function defineConfig(
  config: SodaGqlConfig | (() => SodaGqlConfig),
): SodaGqlConfigContainer {
  const validated = validateConfig(typeof config === "function" ? config() : config);
  if (validated.isErr()) {
    throw validated.error;
  }
  return SodaGqlConfigContainer.create(validated.value);
}

const SchemaConfigSchema = defineSchemaFor<SchemaConfig>()({
  schema: z.string().min(1),
  runtimeAdapter: z.string().min(1),
  scalars: z.string().min(1),
});

const SodaGqlConfigSchema = defineSchemaFor<SodaGqlConfig>()({
  analyzer: z.enum(["ts", "swc"]).optional(),
  outdir: z.string().min(1),
  graphqlSystemAliases: z.array(z.string()).optional(),
  include: z.array(z.string().min(1)),
  exclude: z.array(z.string().min(1)).optional(),
  schemas: z.record(z.string(), SchemaConfigSchema),
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
