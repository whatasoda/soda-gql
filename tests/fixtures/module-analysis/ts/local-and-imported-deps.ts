import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSlice } from "../entities/user";

export const postSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("postId").scalar("ID:!")],
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

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "PageQuery",
      variables: [$var("userId").scalar("ID:!"), $var("postId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
      post: postSlice.embed({ postId: $.postId }),
    }),
  ),
);
