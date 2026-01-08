/**
 * Schema loader for CJS bundle evaluation.
 *
 * Loads AnyGraphqlSchema exports from the generated CJS bundle.
 * Uses shared VM sandbox utility for execution.
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
 * Load AnyGraphqlSchema exports from a generated CJS bundle.
 *
 * The generated CJS bundle exports `__schema_<name>` for each schema
 * when prebuilt mode is enabled. This function executes the bundle
 * in a VM context and extracts those exports.
 *
 * @param cjsPath - Absolute path to the CJS bundle file
 * @param schemaNames - Names of schemas to load (e.g., ["default", "admin"])
 * @returns Record mapping schema names to AnyGraphqlSchema objects
 *
 * @example
 * ```typescript
 * const result = await loadSchemasFromBundle(
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
  const schemas: Record<string, AnyGraphqlSchema> = {};

  for (const name of schemaNames) {
    const exportName = `__schema_${name}`;
    const schema = finalExports[exportName];

    if (schema === undefined) {
      return err({
        code: "SCHEMA_NOT_FOUND",
        message: `Schema export '${exportName}' not found in CJS bundle. Ensure codegen was run with schema '${name}'.`,
        schemaLabel: name,
        canonicalId: exportName,
      });
    }

    // Validate that the export looks like an AnyGraphqlSchema
    if (typeof schema !== "object" || schema === null) {
      return err({
        code: "CONFIG_INVALID",
        message: `Schema export '${exportName}' is not a valid schema object`,
        path: resolvedPath,
      });
    }

    schemas[name] = schema as AnyGraphqlSchema;
  }

  return ok(schemas);
};
