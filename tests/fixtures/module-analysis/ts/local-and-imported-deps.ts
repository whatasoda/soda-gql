import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSlice } from "../entities/user";

export const postSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
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

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "PageQuery",
      variables: [$("userId").scalar("ID:!"), $("postId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
      post: postSlice.load({ postId: $.postId }),
    }),
  ),
);
