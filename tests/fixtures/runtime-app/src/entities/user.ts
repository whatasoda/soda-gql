import { gql } from "@/graphql-system";

type PostModel = {
  readonly id: string;
  readonly title: string;
};

type UserModel = {
  readonly id: string;
  readonly name: string;
  readonly posts: readonly PostModel[];
};

export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.id(),
      f.name(),
      f.posts({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    (selection) => ({
      id: selection.id,
      name: selection.name,
      posts: selection.posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    }),
  ),
);

export const userRemote = {
  forIterate: gql.default(({ model }) =>
    model.User(
      {},
      ({ f }) => [
        //
        f.id(),
        f.name(),
      ],
      (selection) => ({
        id: selection.id,
        name: selection.name,
      }),
    ),
  ),
};

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(() => [
        //
        userModel.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) => select(["$.users"], (result) => result.safeUnwrap(([data]) => data.map((user) => userModel.normalize(user)))),
  ),
);

export const userSliceCatalog = {
  byId: gql.default(({ query }, { $var }) =>
    query.slice(
      {
        variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
      },
      ({ f, $ }) => [
        //
        f.users({
          id: [$.id],
          categoryId: $.categoryId,
        })(({ f }) => [
          //
          f.id(),
          f.name(),
        ]),
      ],
      ({ select }) =>
        select(["$.users"], (result) => result.safeUnwrap(([data]) => data.map((user) => userRemote.forIterate.normalize(user)))),
    ),
  ),
};
