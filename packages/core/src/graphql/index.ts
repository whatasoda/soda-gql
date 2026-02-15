/**
 * Shared GraphQL analysis infrastructure.
 * Re-exports all public types and functions from the graphql module.
 * @module
 */

export { type PreprocessResult, preprocessFragmentArgs } from "./fragment-args-preprocessor";
export { parseGraphqlSource, parseTypeNode } from "./parser";
export { type ErrResult, err, type OkResult, ok, type Result } from "./result";
export { createSchemaIndexFromSchema } from "./schema-adapter";
export {
  createSchemaIndex,
  type DirectiveRecord,
  type EnumRecord,
  type InputRecord,
  type ObjectRecord,
  type OperationTypeNames,
  type ScalarRecord,
  type SchemaIndex,
  type UnionRecord,
} from "./schema-index";
export {
  collectVariableUsages,
  type EnrichedFragment,
  type EnrichedOperation,
  type EnrichedVariable,
  getArgumentType,
  getFieldReturnType,
  getInputFieldType,
  inferVariablesFromUsages,
  isModifierAssignable,
  mergeModifiers,
  mergeVariableUsages,
  sortFragmentsByDependency,
  type TransformOptions,
  type TransformResult,
  transformParsedGraphql,
  type VariableUsage,
} from "./transformer";
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
  ParseResult,
  TypeInfo,
} from "./types";
export {
  type BuiltVarSpecifier,
  buildVarSpecifier,
  buildVarSpecifiers,
} from "./var-specifier-builder";
