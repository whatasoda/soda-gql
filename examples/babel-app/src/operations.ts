import { gql } from "@/graphql-system";
import { updateUserSlice, userSlice, usersSlice, userUpdatesSlice } from "./slices";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [
        //
        $var("userId").scalar("ID:!"),
        $var("categoryId").scalar("ID:!"),
      ],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId, categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ListUsers",
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: usersSlice.embed({ categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.composed(
    {
      operationName: "UpdateUser",
      variables: [
        //
        $var("userId").scalar("ID:!"),
        $var("name").scalar("String:!"),
      ],
    },
    ({ $ }) => ({
      result: updateUserSlice.embed({ id: $.userId, name: $.name }),
    }),
  ),
);

/**
 * Subscription operation for user updates
 */
export const userUpdatesSubscription = gql.default(({ subscription }, { $var }) =>
  subscription.composed(
    {
      operationName: "UserUpdates",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      updates: userUpdatesSlice.embed({ userId: $.userId }),
    }),
  ),
);

/**
 * Query operation with helpers (auth + cache metadata)
 */
export const getProtectedUserQuery = gql.default(({ query }, { $var, auth, cache }) =>
  query.composed(
    {
      operationName: "GetProtectedUser",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:!")],
      metadata: ({ $ }) => ({
        custom: {
          ...auth.requiresLogin(),
          ...cache.ttl(300),
          trackedVariables: [$var.getName($.userId)],
        },
      }),
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId, categoryId: $.categoryId }),
    }),
  ),
);
