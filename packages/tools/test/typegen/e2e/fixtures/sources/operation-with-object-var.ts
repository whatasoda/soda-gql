import { gql } from "../graphql-system";

export const searchUsersQuery = gql.default(({ query }) =>
  query("SearchUsers")`($filter: UserFilter!) { searchUsers(filter: $filter) { id } }`(),
);
