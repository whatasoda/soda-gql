import { gql } from "@/graphql-system";

/**
 * Slice to fetch a single user by ID
 */
export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

/**
 * Slice to fetch all users
 */
export const usersSlice = gql.default(({ query }) =>
  query.slice(
    {},
    ({ f }) => [f.users(({ f }) => [f.id(), f.name(), f.email()])],
    ({ select }) => select(["$.users"], (result) => result),
  ),
);
