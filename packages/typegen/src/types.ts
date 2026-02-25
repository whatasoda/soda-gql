/**
 * Type definitions for typegen package.
 *
 * @module
 */

import type { Result } from "neverthrow";
import type { TypegenError } from "./errors";

/**
 * Options for running typegen.
 */
export type TypegenOptions = {
  /**
   * Absolute path to the output directory (usually config.outdir).
   * This is where the generated graphql-system module resides.
   */
  readonly outdir: string;

  /**
   * Schema names to process.
   */
  readonly schemaNames: readonly string[];

  /**
   * Inject configuration per schema.
   * Maps schema name to inject file paths (absolute paths).
   */
  readonly injects: Record<string, { readonly scalars: string }>;

  /**
   * Whether to include import extensions in generated code.
   */
  readonly importExtension?: boolean;
};

/**
 * Result of a successful typegen run.
 */
export type TypegenSuccess = {
  /**
   * Path to the generated types.prebuilt.ts file.
   */
  readonly prebuiltTypesPath: string;

  /**
   * Number of fragments processed.
   */
  readonly fragmentCount: number;

  /**
   * Number of operations processed.
   */
  readonly operationCount: number;

  /**
   * Warnings encountered during type generation.
   */
  readonly warnings: readonly string[];
};

/**
 * Result type for typegen operations.
 */
export type TypegenResult = Result<TypegenSuccess, TypegenError>;
