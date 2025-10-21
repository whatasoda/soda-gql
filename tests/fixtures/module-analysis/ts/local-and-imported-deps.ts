import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSlice } from "../entities/user";

export const postSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("postId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.posts({ id: $.postId })(({ f }) => [
        //
        f.id(),
      ]),
    ],
    ({ select }) => select(["$.posts"], (result) => result),
  ),
);

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "PageQuery",
      variables: [$("userId").scalar("ID:!"), $("postId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
      post: postSlice.embed({ postId: $.postId }),
    }),
  ),
);
