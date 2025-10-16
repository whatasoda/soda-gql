import { gql } from "@/graphql-system";
import { userSlice, usersSlice } from "./slices";

/**
 * Query to get a single user by ID.
 *
 * This will be transformed to zero-runtime code by the SWC compiler plugin.
 */
export const getUserQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetUser",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
    }),
  ),
);

/**
 * Query to get all users.
 *
 * This demonstrates fetching a list of users with the same fields.
 */
export const getUsersQuery = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "GetUsers",
    },
    () => ({
      users: usersSlice.build(),
    }),
  ),
);
