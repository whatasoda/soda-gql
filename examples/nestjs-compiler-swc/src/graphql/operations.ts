import { gql } from "@/graphql-system";
import { userSlice, usersSlice } from "./slices";

/**
 * Query to get a single user by ID.
 *
 * This will be transformed to zero-runtime code by the SWC compiler plugin.
 */
export const getUserQuery = gql.default(({ query }, { $ }) =>
  query.composed(
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
 * Query to get all users.
 *
 * This demonstrates fetching a list of users with the same fields.
 */
export const getUsersQuery = gql.default(({ operation }) =>
  query.composed(
    {
      operationName: "GetUsers",
    },
    () => ({
      users: usersSlice.embed(),
    }),
  ),
);
