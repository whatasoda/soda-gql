import { dirname, resolve } from "node:path";
import { err, ok, Result } from "neverthrow";
import { type ConfigError, configError } from "./errors";
import type {
  InjectConfig,
  ResolvedArtifactConfig,
  ResolvedCodegenConfig,
  ResolvedInjectConfig,
  ResolvedSodaGqlConfig,
  SchemaInput,
  SodaGqlConfig,
} from "./types";

/**
 * Normalize schema input to resolved array form.
 * String is converted to single-element array.
 * Function is executed to get the array.
 * All paths are resolved relative to config directory.
 */
function normalizeSchemaInput(schema: SchemaInput, configDir: string): Result<readonly string[], ConfigError> {
  // Execute function if provided
  const paths = typeof schema === "function" ? schema() : schema;
  // Normalize single string to array
  const pathArray = typeof paths === "string" ? [paths] : paths;

  // Runtime validation: empty array check
  if (pathArray.length === 0) {
    return err(
      configError({
        code: "CONFIG_VALIDATION_FAILED",
        message: "Schema paths cannot be empty",
      }),
    );
  }

  return ok(pathArray.map((p) => resolve(configDir, p)));
}

/**
 * Normalize inject config to resolved object form.
 * String form is converted to object with same path for all fields.
 */
function normalizeInject(inject: InjectConfig, configDir: string): ResolvedInjectConfig {
  if (typeof inject === "string") {
    const resolvedPath = resolve(configDir, inject);
    return {
      scalars: resolvedPath,
      adapter: resolvedPath,
    };
  }
  return {
    scalars: resolve(configDir, inject.scalars),
    ...(inject.adapter ? { adapter: resolve(configDir, inject.adapter) } : {}),
  };
}

/**
 * Resolve a glob pattern relative to the config directory.
 * Handles negation patterns (e.g., "!./path/to/exclude") by preserving the "!" prefix.
 */
function resolvePattern(pattern: string, configDir: string): string {
  if (pattern.startsWith("!")) {
    // Preserve the negation prefix, resolve the rest
    return `!${resolve(configDir, pattern.slice(1))}`;
  }
  return resolve(configDir, pattern);
}

/**
 * Normalize artifact config to resolved form.
 * Returns undefined if no path is specified.
 */
function normalizeArtifact(artifact: SodaGqlConfig["artifact"], configDir: string): ResolvedArtifactConfig | undefined {
  if (!artifact?.path) {
    return undefined;
  }
  return {
    path: resolve(configDir, artifact.path),
  };
}

/**
 * Normalize codegen config to resolved form with defaults.
 */
function normalizeCodegen(codegen: SodaGqlConfig["codegen"]): ResolvedCodegenConfig {
  return {
    chunkSize: codegen?.chunkSize ?? 100,
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

  // Normalize artifact config (only if path is specified)
  const artifact = normalizeArtifact(config.artifact, configDir);

  // Normalize schemas with error handling
  const schemaEntries = Object.entries(config.schemas).map(([name, schemaConfig]) =>
    normalizeSchemaInput(schemaConfig.schema, configDir).map(
      (schema) =>
        [
          name,
          {
            schema,
            inject: normalizeInject(schemaConfig.inject, configDir),
            defaultInputDepth: schemaConfig.defaultInputDepth ?? 3,
            inputDepthOverrides: schemaConfig.inputDepthOverrides ?? {},
          },
        ] as const,
    ),
  );

  const combinedResult = Result.combine(schemaEntries);
  if (combinedResult.isErr()) {
    return err(combinedResult.error);
  }
  const normalizedSchemas = Object.fromEntries(combinedResult.value);

  const resolved: ResolvedSodaGqlConfig = {
    analyzer,
    baseDir: configDir,
    outdir: resolve(configDir, config.outdir),
    graphqlSystemAliases,
    include: config.include.map((pattern) => resolvePattern(pattern, configDir)),
    exclude: exclude.map((pattern) => resolvePattern(pattern, configDir)),
    schemas: normalizedSchemas,
    styles: {
      importExtension: config.styles?.importExtension ?? false,
    },
    codegen: normalizeCodegen(config.codegen),
    plugins: config.plugins ?? {},
    ...(artifact ? { artifact } : {}),
  };

  return ok(resolved);
}
