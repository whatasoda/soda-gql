import { defineSchemaFor } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import z from "zod";
import { type ConfigError, configError } from "./errors";
import type {
  ArtifactConfig,
  CodegenConfig,
  InjectConfig,
  SchemaConfig,
  SchemaInput,
  SodaGqlConfig,
  StylesConfig,
} from "./types";

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
 * @example Static config with object inject
 * ```ts
 * import { defineConfig } from "@soda-gql/config";
 *
 * export default defineConfig({
 *   outdir: "./graphql-system",
 *   include: ["./src/**\/*.ts"],
 *   schemas: {
 *     default: {
 *       schema: "./schema.graphql",
 *       inject: { scalars: "./scalars.ts" },
 *     },
 *   },
 * });
 * ```
 *
 * @example Static config with string inject (single file)
 * ```ts
 * export default defineConfig({
 *   outdir: "./graphql-system",
 *   include: ["./src/**\/*.ts"],
 *   schemas: {
 *     default: {
 *       schema: "./schema.graphql",
 *       inject: "./inject.ts",  // exports scalar, adapter?
 *     },
 *   },
 * });
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

// InjectConfig is a union type (string | object), so we define the schema directly
// rather than using defineSchemaFor which requires object types
const InjectConfigSchema: z.ZodType<InjectConfig> = z.union([
  z.string().min(1),
  z.object({
    scalars: z.string().min(1),
    adapter: z.string().min(1).optional(),
  }),
]);

// SchemaInput supports string, array of strings, or function returning array of strings
// Function return value validation is deferred to normalize time
const SchemaInputSchema: z.ZodType<SchemaInput> = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
  z.custom<() => readonly string[]>((val) => typeof val === "function"),
]);

const SchemaConfigSchema = defineSchemaFor<SchemaConfig>()({
  schema: SchemaInputSchema,
  inject: InjectConfigSchema,
  defaultInputDepth: z.number().int().positive().max(10).optional(),
  inputDepthOverrides: z.record(z.string(), z.number().int().positive()).optional(),
});

const StylesConfigSchema = defineSchemaFor<StylesConfig>()({
  importExtension: z.boolean().optional(),
});

const CodegenConfigSchema = defineSchemaFor<CodegenConfig>()({
  chunkSize: z.number().int().positive().optional(),
});

const ArtifactConfigSchema = defineSchemaFor<ArtifactConfig>()({
  path: z.string().min(1).optional(),
});

const SodaGqlConfigSchema = defineSchemaFor<SodaGqlConfig>()({
  analyzer: z.enum(["ts", "swc"]).optional(),
  outdir: z.string().min(1),
  graphqlSystemAliases: z.array(z.string()).optional(),
  include: z.array(z.string().min(1)),
  exclude: z.array(z.string().min(1)).optional(),
  schemas: z.record(z.string(), SchemaConfigSchema),
  styles: StylesConfigSchema.optional(),
  codegen: CodegenConfigSchema.optional(),
  plugins: z.record(z.string(), z.unknown()).optional(),
  artifact: ArtifactConfigSchema.optional(),
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
