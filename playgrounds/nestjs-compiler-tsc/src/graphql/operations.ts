import { gql } from "@/graphql-system";

/**
 * Query to get a single user by ID.
 *
 * This will be transformed to zero-runtime code by the TypeScript compiler plugin.
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(() => ({ ...f.id(), ...f.name(), ...f.email() })) }),
  }),
);

/**
 * Query to get all users.
 *
 * This demonstrates fetching a list of users with the same fields.
 */
export const getUsersQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetUsers",
    fields: ({ f }) => ({ ...f.users({})(() => ({ ...f.id(), ...f.name(), ...f.email() })) }),
  }),
);
