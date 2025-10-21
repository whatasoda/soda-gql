import { resolve } from "node:path";
import type { Result } from "neverthrow";
import { ok } from "neverthrow";
import type { ConfigError } from "./errors";
import type { ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

/**
 * Resolve and normalize config with defaults.
 */
export function normalizeConfig(config: SodaGqlConfig): Result<ResolvedSodaGqlConfig, ConfigError> {
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
