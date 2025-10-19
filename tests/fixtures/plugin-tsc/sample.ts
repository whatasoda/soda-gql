import { gql } from "@/graphql-system";

// Simple slice for testing
export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

// Simple operation for testing
export const getUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
    }),
  ),
);
