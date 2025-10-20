import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { Script } from "node:vm";
import { resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import { transformSync } from "@swc/core";
import type { Result } from "neverthrow";
import { err } from "neverthrow";
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
 * Load and execute TypeScript config file synchronously using SWC + VM.
 */
function executeConfigFile(configPath: string): unknown {
  const configFilename = resolve(configPath);
  try {
    // Read the config file
    const source = readFileSync(configFilename, "utf-8");

    // Transform TypeScript to CommonJS using SWC
    const result = transformSync(source, {
      filename: configFilename,
      jsc: {
        parser: {
          syntax: "typescript",
        },
      },
      module: {
        type: "commonjs",
      },
      sourceMaps: false,
      minify: false,
    });

    // Create VM script
    const script = new Script(result.code, { filename: configFilename });

    // Create CommonJS context
    const pseudoModule: { exports: unknown } = { exports: {} };

    const customRequireInner = createRequire(configFilename);
    const customRequire = (specifier: string) => {
      // Handle external modules normally
      if (!specifier.startsWith(".")) {
        return customRequireInner(specifier);
      }

      // Resolve relative imports with existence check
      const resolvedPath = resolveRelativeImportWithExistenceCheck({ filePath: configFilename, specifier });
      if (!resolvedPath) {
        throw new Error(`Module not found: ${specifier}`);
      }
      return customRequireInner(resolvedPath);
    };

    // Execute in VM context
    script.runInNewContext({
      require: customRequire,
      module: pseudoModule,
      exports: pseudoModule.exports,
      __dirname: dirname(configFilename),
      __filename: configFilename,
      console,
      process,
    });

    // Extract config from module.exports
    let config: unknown = pseudoModule.exports;

    // Handle various export formats
    // CommonJS: module.exports = { ... } or module.exports.default = { ... }
    if (config && typeof config === "object" && "default" in config) {
      config = (config as { default: unknown }).default;
    }

    // Synchronous mode doesn't support async config functions
    if (typeof config === "function") {
      throw configError(
        "CONFIG_LOAD_FAILED",
        "Async config functions are not supported in synchronous mode. Export a plain object instead.",
        configFilename,
      );
    }

    return config;
  } catch (error) {
    throw configError(
      "CONFIG_LOAD_FAILED",
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      configFilename,
      error,
    );
  }
}

/**
 * Load config with Result type (for library use).
 */
export function loadConfig(configPath?: string): Result<ResolvedSodaGqlConfig, ConfigError> {
  const resolvedPath = configPath ?? findConfigFile();

  if (!resolvedPath) {
    return err(configError("CONFIG_NOT_FOUND", "Config file not found"));
  }

  try {
    const rawConfig = executeConfigFile(resolvedPath);
    const validated = validateConfig(rawConfig);

    if (validated.isErr()) {
      return err(validated.error);
    }

    return resolveConfig(validated.value, resolvedPath);
  } catch (error) {
    console.log(error);

    return err(configError("CONFIG_LOAD_FAILED", `Failed to load config: ${error}`, resolvedPath, error));
  }
}

/**
 * Load config or throw (for CLI/app use).
 */
export function loadConfigOrThrow(configPath?: string): ResolvedSodaGqlConfig {
  const result = loadConfig(configPath);
  if (result.isErr()) {
    throw new Error(result.error.message);
  }
  return result.value;
}

/**
 * Load config from specific directory.
 */
export function loadConfigFrom(dir: string): Result<ResolvedSodaGqlConfig, ConfigError> {
  const configPath = findConfigFile(dir);
  return loadConfig(configPath ?? undefined);
}
