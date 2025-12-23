// Edge case: Renamed import (gql as g) is NOT recognized by the transformer.
// The transformer looks for the identifier "gql", not the renamed alias.
// This fixture represents that pattern but uses no actual gql code to avoid
// builder errors (the builder uses the same detection logic).
//
// In a real codebase, code like this would NOT be transformed:
//   import { gql as g } from "@/graphql-system";
//   export const model = g.default(({ model }) => ...);

export const placeholder = "renamed-import-test";

