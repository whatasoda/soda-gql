import { resolve } from "node:path";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { z } from "zod";
import type { ConfigError } from "./errors";
import { configError } from "./errors";
import type { ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

const SchemaConfigSchema = z.object({
  schema: z.string().min(1),
  runtimeAdapter: z.string().min(1),
  scalars: z.string().min(1),
});

const SodaGqlConfigSchema = z.object({
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

  return ok(result.data as SodaGqlConfig);
}

/**
 * Resolve and normalize config with defaults.
 */
export function resolveConfig(config: SodaGqlConfig): Result<ResolvedSodaGqlConfig, ConfigError> {
  // Default analyzer to "ts"
  const analyzer = config.analyzer ?? "ts";

  // Default graphqlSystemAliases to ["@/graphql-system"]
  const graphqlSystemAliases = config.graphqlSystemAliases ?? ["@/graphql-system"];

  // Default exclude to empty array
  const exclude = config.exclude ?? [];

  const resolved: ResolvedSodaGqlConfig = {
    analyzer,
    outdir: resolve(config.outdir),
    graphqlSystemAliases,
    include: config.include.map((pattern) => resolve(pattern)),
    exclude: exclude.map((pattern) => resolve(pattern)),
    schemas: Object.fromEntries(
      Object.entries(config.schemas).map(([name, schemaConfig]) => [
        name,
        {
          schema: resolve(schemaConfig.schema),
          runtimeAdapter: resolve(schemaConfig.runtimeAdapter),
          scalars: resolve(schemaConfig.scalars),
        },
      ]),
    ),
    plugins: config.plugins ?? {},
  };

  return ok(resolved);
}
