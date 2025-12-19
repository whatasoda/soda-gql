import { gql } from "@/graphql-system";

/**
 * User model with nested posts
 * Demonstrates model definition with variables and nested field selections
 */
export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.id(),
      f.name(),
      f.email(),
      f.posts({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    (selection) => ({
      id: selection.id,
      name: selection.name,
      email: selection.email,
      posts: selection.posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    }),
  ),
);

/**
 * Simple post model without variables
 */
export const postModel = gql.default(({ model }) =>
  model.Post(
    {},
    ({ f }) => [
      //
      f.id(),
      f.title(),
      f.content(),
      f.author()(({ f }) => [
        //
        f.id(),
        f.name(),
      ]),
    ],
    (selection) => ({
      id: selection.id,
      title: selection.title,
      content: selection.content,
      author: {
        id: selection.author.id,
        name: selection.author.name,
      },
    }),
  ),
);
