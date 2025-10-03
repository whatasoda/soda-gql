import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSlice } from "../entities/user";

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: { ...$("userId").scalar("ID:!") },
    },
    ({ $ }) => ({
      users: userSlice.build({ id: $.userId }),
    }),
  ),
);
