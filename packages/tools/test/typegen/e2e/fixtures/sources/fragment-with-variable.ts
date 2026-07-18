import { gql } from "../graphql-system";

export const userByIdFragment = gql.default(({ fragment }) =>
  fragment("UserByIdFields", "Query")`($id: ID!) { user(id: $id) { id name } }`(),
);
