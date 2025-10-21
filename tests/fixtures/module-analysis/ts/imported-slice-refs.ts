import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSlice } from "../entities/user";

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      users: userSlice.embed({ id: $.userId }),
    }),
  ),
);
