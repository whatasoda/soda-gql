import { dirname, resolve } from "node:path";
import type { Result } from "neverthrow";
import { ok } from "neverthrow";
import type { ConfigError } from "./errors";
import type { InjectConfig, ResolvedInjectConfig, ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

/**
 * Normalize inject config to resolved object form.
 * String form is converted to object with same path for all fields.
 */
function normalizeInject(inject: InjectConfig, configDir: string): ResolvedInjectConfig {
  if (typeof inject === "string") {
    const resolvedPath = resolve(configDir, inject);
    return {
      scalars: resolvedPath,
      helpers: resolvedPath,
      metadata: resolvedPath,
    };
  }
  return {
    scalars: resolve(configDir, inject.scalars),
    ...(inject.helpers ? { helpers: resolve(configDir, inject.helpers) } : {}),
    ...(inject.metadata ? { metadata: resolve(configDir, inject.metadata) } : {}),
  };
}

/**
 * Resolve and normalize config with defaults.
 * Paths in the config are resolved relative to the config file's directory.
 */
export function normalizeConfig(config: SodaGqlConfig, configPath: string): Result<ResolvedSodaGqlConfig, ConfigError> {
  const configDir = dirname(configPath);
  // Default analyzer to "ts"
  const analyzer = config.analyzer ?? "ts";

  // Default graphqlSystemAliases to ["@/graphql-system"]
  const graphqlSystemAliases = config.graphqlSystemAliases ?? ["@/graphql-system"];

  // Default exclude to empty array
  const exclude = config.exclude ?? [];

  const resolved: ResolvedSodaGqlConfig = {
    analyzer,
    outdir: resolve(configDir, config.outdir),
    graphqlSystemAliases,
    include: config.include.map((pattern) => resolve(configDir, pattern)),
    exclude: exclude.map((pattern) => resolve(configDir, pattern)),
    schemas: Object.fromEntries(
      Object.entries(config.schemas).map(([name, schemaConfig]) => [
        name,
        {
          schema: resolve(configDir, schemaConfig.schema),
          inject: normalizeInject(schemaConfig.inject, configDir),
        },
      ]),
    ),
    styles: {
      importExtension: config.styles?.importExtension ?? false,
    },
    plugins: config.plugins ?? {},
  };

  return ok(resolved);
}
