import { gql } from "@/graphql-system";

// Test case: Slice definitions in separate file
// Used by operations.ts to test cross-file transformation order

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("userId").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);
