import { gql } from "../graphql-system";

export const sharedVarsOperation = gql.default(({ query }) =>
  query("SharedVarsOperation")`($id: ID!, $limit: Int) { user(id: $id) { id } users(limit: $limit) { id } }`(),
);

export const sharedVarsFragment = gql.default(({ fragment }) =>
  fragment("SharedVarsFragment", "Query")`($id: ID!, $limit: Int) { user(id: $id) { id } users(limit: $limit) { id } }`(),
);
