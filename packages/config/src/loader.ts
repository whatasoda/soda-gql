import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Result } from "neverthrow";
import { err } from "neverthrow";
import { rolldown } from "rolldown";
import { DEFAULT_CONFIG_FILENAMES } from "./defaults";
import type { ConfigError } from "./errors";
import { configError } from "./errors";
import type { ResolvedSodaGqlConfig } from "./types";
import { resolveConfig, validateConfig } from "./validator";

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
 * Load and execute TypeScript config file using rolldown.
 */
async function executeConfigFile(configPath: string): Promise<unknown> {
  // Bundle config file to temp location (use .cjs so require() is available)
  const outfile = join(tmpdir(), `soda-gql-config-${Date.now()}.cjs`);
  const outdir = dirname(outfile);

  try {
    const bundle = await rolldown({
      input: configPath,
      platform: "node",
      resolve: {
        conditionNames: ["development", "node", "import", "default"],
      },
    });

    await bundle.write({
      format: "cjs",
      dir: outdir,
      entryFileNames: `soda-gql-config-${Date.now()}.cjs`,
    });

    await bundle.close();
  } catch (error) {
    throw configError(
      "CONFIG_LOAD_FAILED",
      `Failed to bundle config: ${error instanceof Error ? error.message : String(error)}`,
      configPath,
      error,
    );
  }

  // Dynamic import the bundled file (import() can load .cjs files)
  const configModule = await import(`file://${outfile}?t=${Date.now()}`);

  // Clean up temp file
  try {
    unlinkSync(outfile);
  } catch (cleanupError) {
    // Ignore cleanup errors
  }

  // When importing CJS with import(), the exports are wrapped in { default: ... }
  // Handle various export formats
  let config = configModule.default?.default ?? configModule.default ?? configModule;

  // Handle async config functions
  if (typeof config === "function") {
    config = await config();
  }

  return config;
}

/**
 * Load config with Result type (for library use).
 */
export async function loadConfig(configPath?: string): Promise<Result<ResolvedSodaGqlConfig, ConfigError>> {
  const resolvedPath = configPath ?? findConfigFile();

  if (!resolvedPath) {
    return err(configError("CONFIG_NOT_FOUND", "Config file not found"));
  }

  try {
    const rawConfig = await executeConfigFile(resolvedPath);
    const validated = validateConfig(rawConfig);

    if (validated.isErr()) {
      return err(validated.error);
    }

    return resolveConfig(validated.value, resolvedPath);
  } catch (error) {
    return err(configError("CONFIG_LOAD_FAILED", `Failed to load config: ${error}`, resolvedPath, error));
  }
}

/**
 * Load config or throw (for CLI/app use).
 */
export async function loadConfigOrThrow(configPath?: string): Promise<ResolvedSodaGqlConfig> {
  const result = await loadConfig(configPath);
  if (result.isErr()) {
    throw new Error(result.error.message);
  }
  return result.value;
}

/**
 * Load config from specific directory.
 */
export async function loadConfigFrom(dir: string): Promise<Result<ResolvedSodaGqlConfig, ConfigError>> {
  const configPath = findConfigFile(dir);
  return loadConfig(configPath ?? undefined);
}
