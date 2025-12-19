import { gql } from "@/graphql-system";
import { updateUserSlice, userSlice, usersSlice, userUpdatesSlice } from "./slices";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetUser",
      variables: [
        //
        $("userId").scalar("ID:!"),
        $("categoryId").scalar("ID:!"),
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
export const listUsersQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ListUsers",
      variables: [$("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: usersSlice.embed({ categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "UpdateUser",
      variables: [
        //
        $("userId").scalar("ID:!"),
        $("name").scalar("String:!"),
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
export const userUpdatesSubscription = gql.default(({ subscription }, { $ }) =>
  subscription.composed(
    {
      operationName: "UserUpdates",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      updates: userUpdatesSlice.embed({ userId: $.userId }),
    }),
  ),
);

/**
 * Query operation with helpers (auth + cache metadata)
 */
export const getProtectedUserQuery = gql.default(({ query }, { $, auth, cache }) =>
  query.composed(
    {
      operationName: "GetProtectedUser",
      variables: [$("userId").scalar("ID:!"), $("categoryId").scalar("ID:!")],
      metadata: ({ $, getVarRefName }) => ({
        custom: {
          ...auth.requiresLogin(),
          ...cache.ttl(300),
          trackedVariables: [getVarRefName($.userId)],
        },
      }),
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId, categoryId: $.categoryId }),
    }),
  ),
);
