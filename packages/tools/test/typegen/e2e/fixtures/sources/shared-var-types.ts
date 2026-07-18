import { gql } from "../graphql-system";

// Compares the operation-side (TypeNode-based) and fragment-side (specifier-based) varTypes
// generators across the divergence-prone cases: single-level lists ($ids required, $tags nullable),
// a NESTED list ($matrix: [[Int!]!]! — deepest bracketing, where recursion vs `[]`-count-split are
// most likely to disagree on inner nullability/depth), and an enum-typed list ($roles). If either
// generator diverges on any of these, the equivalence-lock test fails.
export const sharedVarsOperation = gql.default(({ query }) =>
  query(
    "SharedVarsOperation",
  )`($id: ID!, $limit: Int, $filter: UserFilter!, $ids: [ID!]!, $tags: [String!], $matrix: [[Int!]!]!, $roles: [Role!]) { user(id: $id) { id } users(limit: $limit) { id } searchUsers(filter: $filter) { id } usersByIds(ids: $ids, tags: $tags) { id } usersByMatrix(matrix: $matrix, roles: $roles) { id } }`(),
);

export const sharedVarsFragment = gql.default(({ fragment }) =>
  fragment(
    "SharedVarsFragment",
    "Query",
  )`($id: ID!, $limit: Int, $filter: UserFilter!, $ids: [ID!]!, $tags: [String!], $matrix: [[Int!]!]!, $roles: [Role!]) { user(id: $id) { id } users(limit: $limit) { id } searchUsers(filter: $filter) { id } usersByIds(ids: $ids, tags: $tags) { id } usersByMatrix(matrix: $matrix, roles: $roles) { id } }`(),
);
