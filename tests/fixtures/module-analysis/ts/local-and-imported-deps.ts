import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const postSlice = gql.default(({ querySlice, scalar }) =>
  querySlice(
    [{ postId: scalar("ID", "!") }],
    ({ $, f }) => ({
      posts: f.posts({ id: $.postId }, ({ f }) => f.id()),
    }),
    ({ select }) => select("$.posts", (result) => result),
  )
);

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "PageQuery",
    {
      userId: scalar("ID", "!"),
      postId: scalar("ID", "!"),
    },
    ({ $ }) => ({
      user: userSlice({ id: $.userId }),
      post: postSlice({ postId: $.postId }),
    }),
  )
);
