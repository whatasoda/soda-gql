import { gql } from "@/graphql-system";
import { userModel } from "./models";

/**
 * Query slice to fetch a single user
 */
export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:!")],
      // metadata: () => ({ custom: { hoge: 0 } }),
    },
    ({ f, $ }) => [
      f.user({ id: $.id })(() => [
        userModel.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) =>
      select(["$.user"], (result) =>
        result.safeUnwrap(([user]) => (user ? userModel.normalize(user) : null))
      )
  )
);

/**
 * Query slice to fetch multiple users
 */
export const usersSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({ categoryId: $.categoryId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
    ({ select }) =>
      select(["$.users"], (result) => result.safeUnwrap(([users]) => users))
  )
);

/**
 * Mutation slice to update user
 */
export const updateUserSlice = gql.default(({ mutation }, { $var }) =>
  mutation.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [
      f.updateUser({ id: $.id, name: $.name })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
    ({ select }) => select(["$.updateUser"], (result) => result)
  )
);
