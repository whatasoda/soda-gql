import { gql } from "../graphql-system";

// Includes list variables ($ids required list, $tags nullable list) so the operation-side
// (TypeNode-based) and fragment-side (specifier-based) varTypes generators are compared on the
// list path — the most divergence-prone case (`graphqlTypeToTypeScript` recursion vs
// `applyListModifier`'s `[]` split, plus outer-nullability layering).
export const sharedVarsOperation = gql.default(({ query }) =>
  query(
    "SharedVarsOperation",
  )`($id: ID!, $limit: Int, $filter: UserFilter!, $ids: [ID!]!, $tags: [String!]) { user(id: $id) { id } users(limit: $limit) { id } searchUsers(filter: $filter) { id } usersByIds(ids: $ids, tags: $tags) { id } }`(),
);

export const sharedVarsFragment = gql.default(({ fragment }) =>
  fragment(
    "SharedVarsFragment",
    "Query",
  )`($id: ID!, $limit: Int, $filter: UserFilter!, $ids: [ID!]!, $tags: [String!]) { user(id: $id) { id } users(limit: $limit) { id } searchUsers(filter: $filter) { id } usersByIds(ids: $ids, tags: $tags) { id } }`(),
);
