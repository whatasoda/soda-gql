import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { postSlice, userSlice } from "../entities";

export const complexQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ComplexQuery",
      variables: [$("userId").scalar("ID:!"), $("postId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
      post: postSlice.build({ id: $.postId }),
    }),
  ),
);
