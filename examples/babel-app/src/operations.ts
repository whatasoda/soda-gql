import { gql } from "@/graphql-system";
import { updateUserSlice, userSlice, usersSlice, userUpdatesSlice } from "./slices";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [
        //
        $("userId").scalar("ID:!"),
        $("categoryId").scalar("ID:?"),
      ],
    },
    ({ $ }) => ({
      user: userSlice.load({ id: $.userId, categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Query operation to fetch multiple users
 */
export const listUsersQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ListUsers",
      variables: [$("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: usersSlice.load({ categoryId: $.categoryId }),
    }),
  ),
);

/**
 * Mutation operation to update user
 */
export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: [
        //
        $("userId").scalar("ID:!"),
        $("name").scalar("String:!"),
      ],
    },
    ({ $ }) => ({
      result: updateUserSlice.load({ id: $.userId, name: $.name }),
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
      updates: userUpdatesSlice.load({ userId: $.userId }),
    }),
  ),
);
