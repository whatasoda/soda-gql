/**
 * Shared GraphQL analysis infrastructure.
 * Re-exports all public types and functions from the graphql module.
 * @module
 */

export { ok, err, type Result, type OkResult, type ErrResult } from "./result";
export { parseGraphqlSource, parseTypeNode } from "./parser";
export { preprocessFragmentArgs, type PreprocessResult } from "./fragment-args-preprocessor";
export {
  collectVariableUsages,
  getArgumentType,
  getFieldReturnType,
  getInputFieldType,
  inferVariablesFromUsages,
  isModifierAssignable,
  mergeModifiers,
  mergeVariableUsages,
  sortFragmentsByDependency,
  transformParsedGraphql,
  type EnrichedFragment,
  type EnrichedOperation,
  type EnrichedVariable,
  type TransformOptions,
  type TransformResult,
  type VariableUsage,
} from "./transformer";
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
  buildVarSpecifier,
  buildVarSpecifiers,
  type BuiltVarSpecifier,
} from "./var-specifier-builder";
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
