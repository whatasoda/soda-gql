import { gql } from "@/graphql-system";

// Simple slice for testing
export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

// Simple operation for testing
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);
