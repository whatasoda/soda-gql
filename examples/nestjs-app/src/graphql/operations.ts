import { gql } from "@/graphql-system";
import { createUserSlice, updateUserSlice, userSlice, usersSlice } from "./slices";

/**
 * Query operation to fetch a single user
 */
export const getUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);

/**
 * Query operation to fetch all users
 */
export const listUsersQuery = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "ListUsers",
    },
    () => ({
      users: usersSlice.embed(),
    }),
  ),
);

/**
 * Mutation operation to create a user
 */
export const createUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreateUser",
      variables: [$("name").scalar("String:!"), $("email").scalar("String:!")],
    },
    ({ $ }) => ({
      result: createUserSlice.embed({ name: $.name, email: $.email }),
    }),
  ),
);

/**
 * Mutation operation to update a user
 */
export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.embed({ id: $.userId, name: $.name }),
    }),
  ),
);
