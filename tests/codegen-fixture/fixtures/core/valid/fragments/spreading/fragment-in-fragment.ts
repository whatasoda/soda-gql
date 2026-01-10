import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * Base post fragment
 */
export const postFragment = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }));

/**
 * User fragment that spreads the post fragment in its nested field
 */
export const userWithPostsFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.posts({ categoryId: $.categoryId })(() => ({ ...postFragment.spread() })),
    }),
  }),
);

/**
 * Operation that spreads the composed fragment
 */
export const getUserWithPostsQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUserWithPosts",
    variables: { ...$var("userId").ID("!"), ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(() => ({ ...userWithPostsFragment.spread({ categoryId: $.categoryId }) })),
    }),
  }),
);
