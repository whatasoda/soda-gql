/**
 * Types for graphql-compat code generation.
 * Transforms .graphql operation files to TypeScript compat pattern.
 *
 * Shared GraphQL analysis types (ParsedOperation, ParsedFragment, etc.)
 * are imported from @soda-gql/core to avoid duplication.
 * @module
 */

// Re-export shared GraphQL analysis types from core
/** Backwards-compatible alias for error type. */
// Re-export enriched types from core (previously duplicated in transformer.ts)
export type {
  EnrichedFragment,
  EnrichedOperation,
  EnrichedVariable,
  GraphqlAnalysisError,
  GraphqlAnalysisError as GraphqlCompatError,
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
  TransformOptions,
  TransformResult,
  TypeInfo,
} from "@soda-gql/core";

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
