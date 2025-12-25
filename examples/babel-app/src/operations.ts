import { gql } from "@/graphql-system";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(({ f }) => [
        f.id(),
        f.name(),
        f.email(),
        f.posts({ categoryId: $.categoryId })(({ f }) => [f.id(), f.title()]),
      ]),
    ],
  ),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ListUsers",
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [f.users({ categoryId: $.categoryId })(({ f }) => [f.id(), f.name(), f.email()])],
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation(
    {
      name: "UpdateUser",
      variables: [$var("userId").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.userId, name: $.name })(({ f }) => [f.id(), f.name(), f.email()])],
  ),
);

/**
 * Subscription operation for user updates
 */
export const userUpdatesSubscription = gql.default(({ subscription }, { $var }) =>
  subscription.operation(
    {
      name: "UserUpdates",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.userUpdated({ userId: $.userId })(({ f }) => [f.id(), f.name(), f.email()])],
  ),
);

