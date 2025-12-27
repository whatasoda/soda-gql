import { gql } from "@/graphql-system";

/**
 * User fragment with nested posts
 */
export const userFragment = gql.default(({ fragment }, { $var }) =>
  fragment.User(
    {
      variables: [$var("categoryId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.id(), f.name(), f.email(), f.posts({ categoryId: $.categoryId })(({ f }) => [f.id(), f.title()])],
  ),
);

/**
 * Simple post fragment
 */
export const postFragment = gql.default(({ fragment }) => fragment.Post({}, ({ f }) => [f.id(), f.title(), f.body()]));
