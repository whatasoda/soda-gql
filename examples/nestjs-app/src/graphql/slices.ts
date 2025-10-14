import { gql } from "@/graphql-system";
import { userListModel, userModel } from "./models";

/**
 * Query slice to fetch a single user
 */
export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.id })(() => [
        //
        userModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.user"], (result) => result.safeUnwrap(([user]) => userModel.normalize(user))),
  ),
);

/**
 * Query slice to fetch all users
 */
export const usersSlice = gql.default(({ slice }) =>
  slice.query(
    {},
    ({ f }) => [
      f.users()(() => [
        //
        userListModel.fragment(),
      ]),
    ],
    ({ select }) =>
      select(["$.users"], (result) => result.safeUnwrap(([users]) => users.map((user) => userListModel.normalize(user)))),
  ),
);

/**
 * Mutation slice to create a user
 */
export const createUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [
        //
        $("name").scalar("String:!"),
        $("email").scalar("String:!"),
      ],
    },
    ({ f, $ }) => [
      f.createUser({ name: $.name, email: $.email })(({ f }) => [
        //
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
    ({ select }) => select(["$.createUser"], (result) => result),
  ),
);

/**
 * Mutation slice to update a user
 */
export const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [
        //
        $("id").scalar("ID:!"),
        $("name").scalar("String:!"),
      ],
    },
    ({ f, $ }) => [
      f.updateUser({ id: $.id, name: $.name })(({ f }) => [
        //
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);
