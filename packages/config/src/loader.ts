import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "neverthrow";
import { err } from "neverthrow";
import type { ConfigError } from "./errors";
import { configError } from "./errors";
import { executeConfigFile } from "./evaluation";
import { normalizeConfig } from "./normalize";
import type { ResolvedSodaGqlConfig } from "./types";

export const DEFAULT_CONFIG_FILENAMES = [
  "soda-gql.config.ts",
  "soda-gql.config.mts",
  "soda-gql.config.js",
  "soda-gql.config.mjs",
] as const;

/**
 * Find config file by walking up directory tree.
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;
  while (currentDir !== dirname(currentDir)) {
    for (const filename of DEFAULT_CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }
  return null;
}

/**
 * Load config with Result type (for library use).
 */
export function loadConfig(configPath: string | undefined): Result<ResolvedSodaGqlConfig, ConfigError> {
  const resolvedPath = configPath ?? findConfigFile();

  if (!resolvedPath) {
    return err(configError({ code: "CONFIG_NOT_FOUND", message: "Config file not found" }));
  }

  try {
    const result = executeConfigFile(resolvedPath);
    if (result.isErr()) {
      return err(result.error);
    }
    return normalizeConfig(result.value, resolvedPath);
  } catch (error) {
    return err(
      configError({
        code: "CONFIG_LOAD_FAILED",
        message: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        filePath: resolvedPath,
        cause: error,
      }),
    );
  }
}

/**
 * Load config from specific directory.
 */
export function loadConfigFrom(dir: string): Result<ResolvedSodaGqlConfig, ConfigError> {
  const configPath = findConfigFile(dir);
  return loadConfig(configPath ?? undefined);
}
