import { gql } from "@soda-gql/core";
import { userSlice } from "./slices";

export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    () => ({
      user: userSlice.build({}),
    }),
  ),
);
