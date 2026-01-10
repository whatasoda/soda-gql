import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const postFragment = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id() }) }));

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "PageQuery",
    variables: { ...$var("userId").ID("!"), ...$var("postId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(() => ({ ...topLevelModel.spread() })),
      ...f.posts({ id: $.postId })(() => ({ ...postFragment.spread() })),
    }),
  }),
);
