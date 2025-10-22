import { gql } from "@/graphql-system";
import { userSlice } from "./slices";

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
