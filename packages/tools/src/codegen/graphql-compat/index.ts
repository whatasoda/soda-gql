/**
 * GraphQL Compat code generation module.
 *
 * Transforms .graphql operation files into TypeScript code using the compat pattern.
 *
 * @module
 */

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
  type VariableUsage,
} from "@soda-gql/core";
export * from "./emitter";
export * from "./parser";
export * from "./types";
