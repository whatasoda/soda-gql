import { gql } from "../../codegen-fixture/graphql-system";
import { topLevelModel } from "../common/top-level";

export const postModel = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id()]));

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "PageQuery",
      variables: [$var("userId").scalar("ID:!"), $var("postId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(() => [topLevelModel.embed()]), f.posts({ id: $.postId })(() => [postModel.embed()])],
  ),
);
