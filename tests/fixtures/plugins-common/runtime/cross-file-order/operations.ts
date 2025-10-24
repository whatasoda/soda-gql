import { gql } from "@/graphql-system";
import { userSlice } from "./slices";

// Test case: Operation that imports slice from another file
// Tests runtime import handling and transformation order

export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ userId: $.userId }),
    }),
  ),
);
