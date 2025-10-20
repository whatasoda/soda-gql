import { gql } from "@/graphql-system";

// Simple slice for testing
export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

// Simple operation for testing
export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);
