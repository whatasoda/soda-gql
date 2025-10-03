import { gql } from "@/graphql-system";
import type { AnyModel, AnySlice } from "@soda-gql/core";

type GqlModel = Extract<ReturnType<typeof gql.default>, AnyModel>;
type GqlSlice = Extract<ReturnType<typeof gql.default>, AnySlice>;

type PostModel = {
  readonly id: string;
  readonly title: string;
};

type UserModel = {
  readonly id: string;
  readonly name: string;
  readonly posts: readonly PostModel[];
};

export const userModel: GqlModel = gql.default(({ model }, { $ }) =>
  model(
    {
      typename: "User",
      variables: { ...$("categoryId").scalar("ID:?") },
    },
    ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.posts({ categoryId: $.categoryId }, ({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
    (selection): UserModel => ({
      id: selection.id,
      name: selection.name,
      posts: selection.posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    }),
  ),
);

const userRemoteForIterate: GqlModel = gql.default(({ model }) =>
  model(
    {
      typename: "User",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
    (selection) => ({
      id: selection.id,
      name: selection.name,
    }),
  ),
);

export const userRemote = {
  forIterate: userRemoteForIterate,
};

export const userSlice: GqlSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("id").scalar("ID:!"),
        ...$("categoryId").scalar("ID:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.users({ id: [$.id], categoryId: $.categoryId }, () => ({
        ...userModel.fragment({ categoryId: $.categoryId }),
      })),
    }),
    ({ select }) => select(["$.users"], (result) => result.safeUnwrap(([data]) => data.map((user) => userModel.normalize(user)))),
  ),
);

const userSliceCatalogById: GqlSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("id").scalar("ID:!"),
        ...$("categoryId").scalar("ID:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.users({ id: [$.id], categoryId: $.categoryId }, ({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
    ({ select }) =>
      select(["$.users"], (result) => result.safeUnwrap(([data]) => data.map((user) => userRemote.forIterate.normalize(user)))),
  ),
);

export const userSliceCatalog = {
  byId: userSliceCatalogById,
};
