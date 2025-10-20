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
        $("categoryId").scalar("ID:?"),
      ],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId, categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ mutation }, { $ }) =>
  query.composed(
    {
      operationName: "ListUsers",
      variables: [$("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: usersSlice.build({ categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ operation }, { $ }) =>
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
      result: updateUserSlice.build({ id: $.userId, name: $.name }),
    }),
  ),
);

/**
 * Subscription operation for user updates
 */
export const userUpdatesSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      operationName: "UserUpdates",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      updates: userUpdatesSlice.build({ userId: $.userId }),
    }),
  ),
);
