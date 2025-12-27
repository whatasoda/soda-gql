import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: Slice definitions in separate file
// Used by operations.ts to test cross-file transformation order

export const userSlice = gql.default(({ query }, { $var }) =>
  // @ts-expect-error - query.slice is not yet implemented in types
  query.slice(
    { variables: [$var("userId").scalar("ID:!")] },
    // @ts-expect-error - f, $ parameter types
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
    // @ts-expect-error - select parameter type
    ({ select }) => select(["$.user"], (result) => result),
  ),
);
