import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * Base post model
 */
export const postModel = gql.default(({ model }) =>
  model.Post({}, ({ f }) => [f.id(), f.title()]),
);

/**
 * User model that embeds the post model in its nested field
 */
export const userWithPostsModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.id(),
      f.name(),
      f.posts({ categoryId: $.categoryId })(() => [postModel.embed()]),
    ],
  ),
);

/**
 * Operation that embeds the composed model
 */
export const getUserWithPostsQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUserWithPosts",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(() => [userWithPostsModel.embed({ categoryId: $.categoryId })]),
    ],
  ),
);
