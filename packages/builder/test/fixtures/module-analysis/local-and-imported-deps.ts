import { gql } from "../../codegen-fixture/graphql-system";
import { topLevelModel } from "../common/top-level";

export const postFragment = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id() }) }));

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "PageQuery",
    variables: { ...$var("userId").scalar("ID:!"), ...$var("postId").scalar("ID:!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({ ...topLevelModel.embed() })),
      ...f.posts({ id: $.postId })(({ f }) => ({ ...postFragment.embed() })),
    }),
  }),
);
