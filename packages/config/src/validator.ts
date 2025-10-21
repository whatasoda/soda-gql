import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { z } from "zod";
import { DEFAULT_CORE_PATH } from "./defaults";
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
  corePath: z.string().optional(),
});

export function validateConfig(config: unknown): Result<SodaGqlConfig, ConfigError> {
  const result = SodaGqlConfigSchema.safeParse(config);

  if (!result.success) {
    return err(configError("CONFIG_VALIDATION_FAILED", `Invalid config: ${result.error.message}`));
  }

  return ok(result.data as SodaGqlConfig);
}

/**
 * Resolve and normalize config with defaults.
 */
export function resolveConfig(config: SodaGqlConfig, configPath: string): Result<ResolvedSodaGqlConfig, ConfigError> {
  const configDir = dirname(configPath);

  // Normalize to absolute paths
  const resolveFromConfig = (path: string): string => {
    return isAbsolute(path) ? path : resolve(configDir, path);
  };

  // Compute config hash for cache invalidation
  const stats = statSync(configPath);
  const configHash = createHash("sha256").update(readFileSync(configPath)).digest("hex").slice(0, 16);

  // Default analyzer to "ts"
  const analyzer = config.analyzer ?? "ts";

  // Default graphqlSystemAliases to ["@/<basename(outdir)>"]
  const graphqlSystemAliases = config.graphqlSystemAliases ?? [`@/${basename(config.outdir)}`];

  // Default exclude to empty array
  const exclude = config.exclude ?? [];

  // Resolve corePath
  const corePath = config.corePath ? resolveFromConfig(config.corePath) : DEFAULT_CORE_PATH;

  const resolved: ResolvedSodaGqlConfig = {
    analyzer,
    outdir: resolveFromConfig(config.outdir),
    graphqlSystemAliases,
    include: config.include.map(resolveFromConfig),
    exclude: exclude.map(resolveFromConfig),
    schemas: Object.fromEntries(
      Object.entries(config.schemas).map(([name, schemaConfig]) => [
        name,
        {
          schema: resolveFromConfig(schemaConfig.schema),
          runtimeAdapter: resolveFromConfig(schemaConfig.runtimeAdapter),
          scalars: resolveFromConfig(schemaConfig.scalars),
        },
      ]),
    ),
    plugins: config.plugins ?? {},
    corePath,
    configDir,
    configPath,
    configHash,
    configMtime: stats.mtimeMs,
  };

  return ok(resolved);
}
