import { gql } from '@/graphql-system';

/**
 * User model definition
 */
export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      f.id(),
      f.name(),
      f.email(),
      f.posts()(({ f }) => [
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
 * Simple user model for listing
 */
export const userListModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      f.id(),
      f.name(),
      f.email(),
    ],
    (selection) => ({
      id: selection.id,
      name: selection.name,
      email: selection.email,
    }),
  ),
);
