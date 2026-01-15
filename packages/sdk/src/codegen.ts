/**
 * Codegen API for programmatic code generation from GraphQL schemas.
 * @module
 */

import { join } from "node:path";
import type { CodegenError, CodegenSuccess } from "@soda-gql/codegen";
import { runCodegen } from "@soda-gql/codegen";
import type { ConfigError } from "@soda-gql/config";
import { loadConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";

/**
 * Error type for codegen operations.
 * Can be either a config loading error or a codegen error.
 */
export type CodegenSdkError = ConfigError | CodegenError;

/**
 * Options for codegenAsync function.
 */
export interface CodegenSdkOptions {
  /** Path to soda-gql config file (optional, will search if not provided) */
  configPath?: string;
}

/**
 * Result of codegen operations.
 */
export interface CodegenSdkResult {
  /** Generated schema information */
  schemas: CodegenSuccess["schemas"];
  /** Path to generated TypeScript module */
  outPath: string;
  /** Path to internal module */
  internalPath: string;
  /** Path to injects module */
  injectsPath: string;
  /** Path to CommonJS bundle */
  cjsPath: string;
}

/**
 * Generate GraphQL runtime module asynchronously from a config file.
 *
 * @remarks
 * This function loads the soda-gql config, validates the schemas configuration,
 * and generates TypeScript/CommonJS modules from GraphQL schemas.
 *
 * @param options - Codegen options including optional config path
 * @returns Promise resolving to Result containing the generation result or an error
 *
 * @example
 * ```typescript
 * const result = await codegenAsync({ configPath: './soda-gql.config.ts' });
 * if (result.isOk()) {
 *   console.log('Generated:', result.value.outPath);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Without explicit config path (will search for config file)
 * const result = await codegenAsync();
 * ```
 */
export const codegenAsync = async (options: CodegenSdkOptions = {}): Promise<Result<CodegenSdkResult, CodegenSdkError>> => {
  const { configPath } = options;

  // Load config from file path
  const configResult = loadConfig(configPath);
  if (configResult.isErr()) {
    return err(configResult.error);
  }
  const config = configResult.value;

  // Validate schemas config exists
  if (!config.schemas || Object.keys(config.schemas).length === 0) {
    return err({
      code: "CONFIG_VALIDATION_FAILED",
      message: "schemas configuration is required in soda-gql config",
    });
  }

  // Derive output path from outdir (already absolute)
  const outPath = join(config.outdir, "index.ts");

  // Run codegen (config.schemas is already resolved by loadConfig)
  const result = await runCodegen({
    schemas: config.schemas,
    outPath,
    format: "human",
    importExtension: config.styles.importExtension,
  });

  if (result.isErr()) {
    return err(result.error);
  }

  return ok({
    schemas: result.value.schemas,
    outPath: result.value.outPath,
    internalPath: result.value.internalPath,
    injectsPath: result.value.injectsPath,
    cjsPath: result.value.cjsPath,
  });
};
