import { gql } from "@/graphql-system";

/**
 * User model with nested posts
 */
export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.id(), f.name(), f.email(), f.posts({ categoryId: $.categoryId })(({ f }) => [f.id(), f.title()])],
  ),
);

/**
 * Simple post model
 */
export const postModel = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id(), f.title(), f.body()]));
