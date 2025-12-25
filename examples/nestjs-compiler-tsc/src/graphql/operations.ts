import { gql } from "@/graphql-system";
import { userSlice, usersSlice } from "./slices";

/**
 * Query to get a single user by ID.
 *
 * This will be transformed to zero-runtime code by the TypeScript compiler plugin.
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
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
export const getUsersQuery = gql.default(({ query }) =>
  query.composed(
    {
      name: "GetUsers",
    },
    () => ({
      users: usersSlice.embed(),
    }),
  ),
);

export const inline = gql.default(({ query }) =>
  query.inline(
    {
      name: "InlineTest",
    },
    ({ f }) => [
      //
      f.users()(({ f }) => [
        //
        f.id(),
        f.name(),
        f.email(),
      ]),
    ],
  ),
);
