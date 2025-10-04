import { gql } from "@/graphql-system";

type UserModel = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
  readonly avatar: string | null;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
};

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      f.id(),
      f.email(),
      f.firstName(),
      f.lastName(),
      f.role(),
      f.avatar(),
      f.createdAt(),
      f.lastLoginAt(),
    ],
    (selection): UserModel => ({
      id: selection.id,
      email: selection.email,
      firstName: selection.firstName,
      lastName: selection.lastName,
      role: selection.role,
      avatar: selection.avatar,
      createdAt: selection.createdAt,
      lastLoginAt: selection.lastLoginAt,
    }),
  ),
);

export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.id })(() => [
        userModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.user"], (result) => result.map((data) => (data ? userModel.normalize(data) : null))),
  ),
);

export const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [
        $("id").scalar("ID:!"),
        $("firstName").scalar("String:?"),
        $("lastName").scalar("String:?"),
        $("avatar").scalar("String:?"),
      ],
    },
    ({ f, $ }) => [
      f.updateUserProfile({ id: $.id, firstName: $.firstName, lastName: $.lastName, avatar: $.avatar })(() => [
        userModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.updateUserProfile"], (result) => result.map((data) => userModel.normalize(data))),
  ),
);
