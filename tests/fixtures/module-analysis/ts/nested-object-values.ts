import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { postSlice, userSlice } from "../entities";

export const complexQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ComplexQuery",
      variables: [$var("userId").scalar("ID:!"), $var("postId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
      post: postSlice.embed({ id: $.postId }),
    }),
  ),
);
