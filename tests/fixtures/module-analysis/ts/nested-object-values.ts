import { gql } from "@/graphql-system";
import { userSlice, postSlice } from "../entities";

export const complexQuery = gql.default(({ query, scalar }) =>
  query(
    "ComplexQuery",
    {
      userId: scalar("ID", "!"),
      postId: scalar("ID", "!"),
    },
    ({ $ }) => ({
      result: {
        user: userSlice({ id: $.userId }),
        post: postSlice({ id: $.postId }),
      },
    }),
  )
);
