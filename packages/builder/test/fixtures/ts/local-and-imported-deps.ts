import { gql } from "../../codegen-fixture/graphql-system";
import { topLevelQuery } from "../common/top-level";

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
      user: topLevelQuery.embed({ userId: $.userId }),
      post: postSlice.embed({ postId: $.postId }),
    }),
  ),
);
