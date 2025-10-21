import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path/posix";
import { Script } from "node:vm";
import { resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import { transformSync } from "@swc/core";
import { configError } from "./errors";
import { SodaGqlConfigContainer } from "./helper";
import type { SodaGqlConfig } from "./types";

/**
 * Load and execute TypeScript config file synchronously using SWC + VM.
 */
export function executeConfigFile(configPath: string): SodaGqlConfig {
  const filePath = resolve(configPath);
  try {
    // Read the config file
    const source = readFileSync(filePath, "utf-8");

    // Transform TypeScript to CommonJS using SWC
    const result = transformSync(source, {
      filename: filePath,
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

    // Create CommonJS context
    const mod: { exports: unknown } = { exports: {} };

    const requireInner = createRequire(filePath);
    const require = (specifier: string) => {
      // Handle external modules normally
      if (!specifier.startsWith(".")) {
        return requireInner(specifier);
      }

      // Resolve relative imports with existence check
      const resolvedPath = resolveRelativeImportWithExistenceCheck({ filePath, specifier });
      if (!resolvedPath) {
        throw new Error(`Module not found: ${specifier}`);
      }
      return requireInner(resolvedPath);
    };

    // Execute in VM context
    new Script(result.code, { filename: filePath }).runInNewContext({
      require,
      module: mod,
      exports: mod.exports,
      __dirname: dirname(filePath),
      __filename: filePath,
      console,
      process,
    });

    const config =
      mod.exports &&
      typeof mod.exports === "object" &&
      "default" in mod.exports &&
      mod.exports.default instanceof SodaGqlConfigContainer
        ? mod.exports.default.config
        : null;

    if (!config) {
      throw new Error("Invalid config module");
    }

    return config;
  } catch (error) {
    throw configError({
      code: "CONFIG_LOAD_FAILED",
      message: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      filePath: filePath,
      cause: error,
    });
  }
}
