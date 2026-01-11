// Edge case: gql.default() called with non-function argument
// The transformer requires an arrow function as the first argument.
// Calls with string/object/other arguments are NOT recognized.
//
// In a real codebase, code like this would NOT be transformed:
//   import { gql } from "../../../../../graphql-system";
//   export const wrongTypeCall = gql.default("not a function");

export const placeholder = "invalid-call-wrong-type-test";
