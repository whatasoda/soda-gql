/**
 * Types for graphql-compat code generation.
 * Transforms .graphql operation files to TypeScript compat pattern.
 *
 * Shared GraphQL analysis types (ParsedOperation, ParsedFragment, etc.)
 * are imported from @soda-gql/core to avoid duplication.
 * @module
 */

// Re-export shared GraphQL analysis types from core
export type {
  GraphqlAnalysisError,
  InferredVariable,
  ParsedArgument,
  ParsedFieldSelection,
  ParsedFragment,
  ParsedFragmentSpread,
  ParsedInlineFragment,
  ParsedObjectField,
  ParsedOperation,
  ParsedSelection,
  ParsedValue,
  ParsedVariable,
  ParseResultBase as ParseResult,
  TypeInfo,
} from "@soda-gql/core";

/** Backwards-compatible alias for error type. */
export type { GraphqlAnalysisError as GraphqlCompatError } from "@soda-gql/core";

/**
 * Options for running graphql-compat code generation.
 */
export type GraphqlCompatOptions = {
  /** Schema name from config */
  readonly schemaName: string;
  /** Resolved paths to .graphql operation files */
  readonly operationFiles: readonly string[];
  /** Output directory for generated files */
  readonly outputDir?: string;
  /** Import path for graphql-system module (e.g., "@/graphql-system") */
  readonly graphqlSystemPath: string;
};

/**
 * Generated file output.
 */
export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};
