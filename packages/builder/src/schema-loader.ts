/**
 * Schema loader for CJS bundle evaluation.
 *
 * Loads AnyGraphqlSchema from the generated CJS bundle by accessing
 * the `$schema` property on each gql composer.
 *
 * @module
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnyGraphqlSchema } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "./errors";
import { executeSandbox } from "./vm/sandbox";

/**
 * Result of loading schemas from a CJS bundle.
 */
export type LoadSchemasResult = Result<Record<string, AnyGraphqlSchema>, BuilderError>;

/**
 * Load AnyGraphqlSchema from a generated CJS bundle.
 *
 * The generated CJS bundle exports a `gql` object where each property
 * is a GQL element composer with a `$schema` property containing the
 * schema definition. This function executes the bundle in a VM context
 * and extracts those schemas.
 *
 * @param cjsPath - Absolute path to the CJS bundle file
 * @param schemaNames - Names of schemas to load (e.g., ["default", "admin"])
 * @returns Record mapping schema names to AnyGraphqlSchema objects
 *
 * @example
 * ```typescript
 * const result = loadSchemasFromBundle(
 *   "/path/to/generated/index.cjs",
 *   ["default"]
 * );
 *
 * if (result.isOk()) {
 *   const schemas = result.value;
 *   console.log(schemas.default); // AnyGraphqlSchema
 * }
 * ```
 */
export const loadSchemasFromBundle = (
  cjsPath: string,
  schemaNames: readonly string[],
): LoadSchemasResult => {
  const resolvedPath = resolve(cjsPath);

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    return err({
      code: "CONFIG_NOT_FOUND",
      message: `CJS bundle not found: ${resolvedPath}. Run 'soda-gql codegen' first.`,
      path: resolvedPath,
    });
  }

  // Read the bundled code
  let bundledCode: string;
  try {
    bundledCode = readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    return err({
      code: "DISCOVERY_IO_ERROR",
      message: `Failed to read CJS bundle: ${error instanceof Error ? error.message : String(error)}`,
      path: resolvedPath,
      cause: error,
    });
  }

  // Execute the bundle in sandbox
  let finalExports: Record<string, unknown>;
  try {
    finalExports = executeSandbox(bundledCode, resolvedPath);
  } catch (error) {
    return err({
      code: "RUNTIME_MODULE_LOAD_FAILED",
      message: `Failed to execute CJS bundle: ${error instanceof Error ? error.message : String(error)}`,
      filePath: resolvedPath,
      astPath: "",
      cause: error,
    });
  }

  // Extract gql object from exports
  const gql = finalExports.gql as Record<string, { $schema?: unknown }> | undefined;

  if (!gql || typeof gql !== "object") {
    return err({
      code: "CONFIG_INVALID",
      message: "CJS bundle does not export 'gql' object. Ensure codegen was run successfully.",
      path: resolvedPath,
    });
  }

  const schemas: Record<string, AnyGraphqlSchema> = {};

  for (const name of schemaNames) {
    const composer = gql[name];

    if (!composer) {
      const availableSchemas = Object.keys(gql).join(", ");
      return err({
        code: "SCHEMA_NOT_FOUND",
        message: `Schema '${name}' not found in gql exports. Available: ${availableSchemas || "(none)"}`,
        schemaLabel: name,
        canonicalId: `gql.${name}`,
      });
    }

    const schema = composer.$schema;

    // Validate that the $schema property exists and is an object
    if (!schema || typeof schema !== "object") {
      return err({
        code: "CONFIG_INVALID",
        message: `gql.${name}.$schema is not a valid schema object. Ensure codegen version is up to date.`,
        path: resolvedPath,
      });
    }

    schemas[name] = schema as AnyGraphqlSchema;
  }

  return ok(schemas);
};
