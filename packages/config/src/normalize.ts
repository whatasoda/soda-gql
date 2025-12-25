import { dirname, resolve } from "node:path";
import type { Result } from "neverthrow";
import { ok } from "neverthrow";
import type { ConfigError } from "./errors";
import type { ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

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

  // Resolve metadata adapter path if specified, otherwise null to generate default
  const metadata = config.metadata ? resolve(configDir, config.metadata) : null;

  const resolved: ResolvedSodaGqlConfig = {
    analyzer,
    metadata,
    outdir: resolve(configDir, config.outdir),
    graphqlSystemAliases,
    include: config.include.map((pattern) => resolve(configDir, pattern)),
    exclude: exclude.map((pattern) => resolve(configDir, pattern)),
    schemas: Object.fromEntries(
      Object.entries(config.schemas).map(([name, schemaConfig]) => [
        name,
        {
          schema: resolve(configDir, schemaConfig.schema),
          scalars: resolve(configDir, schemaConfig.scalars),
          ...(schemaConfig.helpers ? { helpers: resolve(configDir, schemaConfig.helpers) } : {}),
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
