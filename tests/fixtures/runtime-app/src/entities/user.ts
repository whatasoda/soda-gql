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

export const userModel = gql.model(
  ["User", { categoryId: gql.scalar("ID", "?") }],
  ({ f, $ }) => ({
    ...f.id(),
    ...f.name(),
    posts: f.posts({ categoryId: $.categoryId }, ({ f }) => ({
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
);

export const userSlice = gql.querySlice(
  [
    {
      id: gql.scalar("ID", "!"),
      categoryId: gql.scalar("ID", "?"),
    },
  ],
  ({ f, $ }) => ({
    users: f.users({ id: [$.id], categoryId: $.categoryId }, () => ({
      ...userModel.fragment({ categoryId: $.categoryId }),
    })),
  }),
  ({ select }) => select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => userModel.transform(user)))),
);
