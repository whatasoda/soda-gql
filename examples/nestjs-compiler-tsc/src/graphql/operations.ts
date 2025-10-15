import { gql } from '@/graphql-system';

/**
 * Query to get a single user by ID.
 *
 * This will be transformed to zero-runtime code by the TypeScript compiler plugin.
 */
export const getUserQuery = gql.operation.query('GetUser', ({ f, $ }) => ({
  user: f.user({ id: $.userId }, ({ f }) => ({
    id: f.id,
    name: f.name,
    email: f.email,
  })),
}));

/**
 * Query to get all users.
 *
 * This demonstrates fetching a list of users with the same fields.
 */
export const getUsersQuery = gql.operation.query('GetUsers', ({ f }) => ({
  users: f.users(({f}) => ({
    id: f.id,
    name: f.name,
    email: f.email,
  })),
}));
