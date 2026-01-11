// Edge case: Star import (import * as gqlSystem) pattern.
// NOTE: This pattern is not currently supported by the builder's analyzer.
// The transformer can detect gqlSystem.gql.default(...) but the builder
// doesn't generate artifacts for this import style.
//
// In a real codebase, this would NOT be transformed due to builder limitation:
//   import * as gqlSystem from "../../../../../graphql-system";
//   export const userFragment = gqlSystem.gql.default(({ fragment }) => ...);

export const placeholder = "star-import-test";
