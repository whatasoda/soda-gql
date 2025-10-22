import { gql } from "@/graphql-system";
// Import slices to test that cross-file imports are preserved after transformation
// Note: We don't use these in the operation itself due to builder evaluation limitations
import { userSlice, postsSlice } from "./slices";

export const getUserAndPosts = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUserAndPosts",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
      posts: postsSlice.embed({ limit: 10 }),
    })
  ),
);
