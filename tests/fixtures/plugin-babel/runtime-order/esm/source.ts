import { gql } from "@soda-gql/core";
import { userSlice } from "./slices";

export const getUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    () => ({
      user: userSlice.build({}),
    }),
  ),
);
