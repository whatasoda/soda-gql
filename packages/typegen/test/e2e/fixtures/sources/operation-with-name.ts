import { gql } from "../graphql-system";

export const getUserQuery = gql.default(({ query }) =>
  query`query GetUser($id: ID!) { user(id: $id) { id name } }`(),
);
