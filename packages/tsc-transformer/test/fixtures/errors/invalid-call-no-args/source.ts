// Edge case: gql.default() called with no arguments
// The transformer requires an arrow function as the first argument.
// Calls without arguments are NOT recognized as gql definition calls.
//
// In a real codebase, code like this would NOT be transformed:
//   import { gql } from "@/graphql-system";
//   export const noArgCall = gql.default();

export const placeholder = "invalid-call-no-args-test";
