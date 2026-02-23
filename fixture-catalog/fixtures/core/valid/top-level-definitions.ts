import { gql } from "../../../graphql-system";

export const pageQuery = gql.default(({ query }) =>
  query("ProfilePageQuery")`($userId: ID!) { employee(id: $userId) { id } }`(),
);
