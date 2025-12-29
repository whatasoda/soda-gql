import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * Base post fragment
 */
export const postFragment = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }));

/**
 * User fragment that embeds the post fragment in its nested field
 */
export const userWithPostsFragment = gql.default(({ fragment }, { $var }) =>
  fragment.User({
    variables: { ...$var("categoryId").scalar("ID:?") },
    fields: ({ f, $ }) => ({ ...f.id(), ...f.name(), ...f.posts({ categoryId: $.categoryId })(({ f }) => ({ ...postFragment.embed() })) }),
  }),
);

/**
 * Operation that embeds the composed fragment
 */
export const getUserWithPostsQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUserWithPosts",
    variables: { ...$var("userId").scalar("ID:!"), ...$var("categoryId").scalar("ID:?") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...userWithPostsFragment.embed({ categoryId: $.categoryId }) })) }),
  }),
);
