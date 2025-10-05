import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import type { ResolvedSodaGqlConfig, SodaGqlConfig } from "./types";

/**
 * Find config file starting from the given directory and walking up.
 */
export const findConfigFile = (startDir: string = process.cwd()): string | null => {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    // Try .ts first, then .js
    const tsConfig = join(currentDir, "soda-gql.config.ts");
    const jsConfig = join(currentDir, "soda-gql.config.js");

    if (existsSync(tsConfig)) {
      return tsConfig;
    }
    if (existsSync(jsConfig)) {
      return jsConfig;
    }

    currentDir = dirname(currentDir);
  }

  return null;
};

/**
 * Load and resolve configuration from file.
 */
export const loadConfig = async (configPath?: string): Promise<Result<ResolvedSodaGqlConfig, BuilderError>> => {
  // Find config file if not specified
  const resolvedConfigPath = configPath ?? findConfigFile();

  if (!resolvedConfigPath) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: "",
      astPath: "",
      message: "Config file not found. Create soda-gql.config.ts in your project root.",
    });
  }

  if (!existsSync(resolvedConfigPath)) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: resolvedConfigPath,
      astPath: "",
      message: `Config file not found: ${resolvedConfigPath}`,
    });
  }

  // Load config file
  let config: SodaGqlConfig;
  try {
    // Use dynamic import with cache busting
    const configModule = await import(`${resolvedConfigPath}?t=${Date.now()}`);
    config = configModule.default ?? configModule;
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: resolvedConfigPath,
      astPath: "",
      message: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Validate required fields
  if (!config.graphqlSystemPath) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: resolvedConfigPath,
      astPath: "",
      message: "Config must specify graphqlSystemPath",
    });
  }

  if (!config.outDir) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: resolvedConfigPath,
      astPath: "",
      message: "Config must specify outDir",
    });
  }

  if (!config.entry || config.entry.length === 0) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: resolvedConfigPath,
      astPath: "",
      message: "Config must specify entry patterns",
    });
  }

  // Resolve paths
  const configDir = dirname(resolvedConfigPath);

  const resolvePathFromConfig = (path: string): string => {
    if (isAbsolute(path)) {
      return path;
    }
    return resolve(configDir, path);
  };

  const resolvedConfig: ResolvedSodaGqlConfig = {
    graphqlSystemPath: resolvePathFromConfig(config.graphqlSystemPath),
    corePath: config.corePath ? resolvePathFromConfig(config.corePath) : join(configDir, "node_modules", "@soda-gql", "core"),
    outDir: resolvePathFromConfig(config.outDir),
    entry: config.entry.map(resolvePathFromConfig),
    schema: config.schema ? resolvePathFromConfig(config.schema) : undefined,
    analyzer: config.analyzer ?? "ts",
    mode: config.mode ?? "runtime",
    configDir,
  };

  return ok(resolvedConfig);
};
