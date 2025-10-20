import { gql } from "@/graphql-system";
import { userModel } from "./models";

/**
 * Query slice to fetch a single user
 */
export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("id").scalar("ID:!"), $("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.id })(() => [
        //
        userModel.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) => select(["$.user"], (result) => result.safeUnwrap(([user]) => (user ? userModel.normalize(user) : null))),
  ),
);

/**
 * Query slice to fetch multiple users
 */
export const usersSlice = gql.default(({ mutation }, { $ }) =>
  query.slice(
    {
      variables: [$("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
    ({ select }) => select(["$.users"], (result) => result.safeUnwrap(([users]) => users)),
  ),
);

/**
 * Mutation slice to update user
 */
export const updateUserSlice = gql.default(({ mutation }, { $ }) =>
  mutation.slice(
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

/**
 * Subscription slice for user updates
 */
export const userUpdatesSlice = gql.default(({ subscription }, { $ }) =>
  subscription.slice(
    {
      variables: [$("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.userUpdated({ userId: $.userId })(({ f }) => [f.id(), f.name(), f.email()])],
    ({ select }) => select(["$.userUpdated"], (result) => result),
  ),
);
