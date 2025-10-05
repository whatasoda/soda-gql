import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { z } from "zod";
import { DEFAULT_BUILDER_CONFIG, DEFAULT_CORE_PATH } from "./defaults";
import type { ConfigError } from "./errors";
import { configError } from "./errors";
import type { ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

const BuilderConfigSchema = z.object({
  entry: z.array(z.string()).optional(),
  outDir: z.string().min(1).optional(),
  analyzer: z.enum(["ts", "babel"]).optional(),
  mode: z.enum(["runtime", "zero-runtime"]).optional(),
});

const CodegenConfigSchema = z.object({
  schema: z.string().min(1),
  outDir: z.string().min(1),
});

const ProjectConfigSchema = z.object({
  graphqlSystemPath: z.string().min(1),
  corePath: z.string().optional(),
  builder: BuilderConfigSchema.optional(),
  codegen: CodegenConfigSchema.optional(),
  plugins: z.record(z.unknown()).optional(),
});

const SodaGqlConfigSchema = z.object({
  // Single project mode
  graphqlSystemPath: z.string().optional(),
  corePath: z.string().optional(),
  builder: BuilderConfigSchema.optional(),
  codegen: CodegenConfigSchema.optional(),
  plugins: z.record(z.unknown()).optional(),

  // Multi-project mode
  projects: z.record(ProjectConfigSchema).optional(),
  defaultProject: z.string().optional(),
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

  // Handle single-project mode
  if (!config.projects) {
    if (!config.graphqlSystemPath) {
      return err(configError("CONFIG_VALIDATION_FAILED", "graphqlSystemPath is required in single-project mode"));
    }

    // Compute config hash for cache invalidation
    const stats = statSync(configPath);
    const configHash = createHash("sha256").update(readFileSync(configPath)).digest("hex").slice(0, 16);

    return ok({
      graphqlSystemPath: resolveFromConfig(config.graphqlSystemPath),
      corePath: config.corePath ? resolveFromConfig(config.corePath) : DEFAULT_CORE_PATH,
      builder: {
        ...DEFAULT_BUILDER_CONFIG,
        ...(config.builder ?? {}),
        entry: (config.builder?.entry ?? []).map(resolveFromConfig),
        outDir: resolveFromConfig(config.builder?.outDir ?? DEFAULT_BUILDER_CONFIG.outDir),
      },
      codegen: config.codegen
        ? {
            schema: resolveFromConfig(config.codegen.schema),
            outDir: resolveFromConfig(config.codegen.outDir),
          }
        : undefined,
      plugins: config.plugins ?? {},
      configDir,
      configPath,
      configHash,
      configMtime: stats.mtimeMs,
    });
  }

  // TODO: Multi-project mode support
  return err(configError("CONFIG_VALIDATION_FAILED", "Multi-project mode not yet implemented"));
}
