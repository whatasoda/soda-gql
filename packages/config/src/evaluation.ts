import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path/posix";
import { Script } from "node:vm";
import { resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";
import { type ConfigError, configError } from "./errors";
import { SodaGqlConfigContainer } from "./helper";
// TODO: split config package into definition and evaluation parts
import * as configModule from "./index";
import type { SodaGqlConfig } from "./types";

type TransformSync = typeof import("@swc/core").transformSync;

/** Lazily resolve @swc/core from the config file's directory, falling back to package resolution. */
const resolveSwc = (configPath: string): TransformSync => {
  try {
    const localRequire = createRequire(configPath);
    return localRequire("@swc/core").transformSync;
  } catch (primaryError) {
    // import.meta.url is undefined in CJS bundles (esbuild replaces import.meta with {})
    if (typeof import.meta.url !== "string") {
      throw primaryError;
    }
    // Fall back to package-level resolution (e.g., during tests or when user relies on bundled swc)
    const packageRequire = createRequire(import.meta.url);
    return packageRequire("@swc/core").transformSync;
  }
};

/**
 * Load and execute TypeScript config file synchronously using SWC + VM.
 */
export function executeConfigFile(configPath: string): Result<SodaGqlConfig, ConfigError> {
  const filePath = resolve(configPath);
  try {
    const transformSync = resolveSwc(filePath);

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
      if (specifier === "@soda-gql/config") {
        return configModule;
      }

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

    return ok(config);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Cannot find module '@swc/core'")
        ? "@swc/core not found. Install it in your project: bun add -D @swc/core"
        : `Failed to load config: ${error instanceof Error ? error.message : String(error)}`;
    return err(
      configError({
        code: "CONFIG_LOAD_FAILED",
        message,
        filePath: filePath,
        cause: error,
      }),
    );
  }
}
