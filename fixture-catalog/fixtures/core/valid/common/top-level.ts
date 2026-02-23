import { gql } from "../../../../graphql-system";

export const topLevelModel = gql.default(({ fragment }) => fragment("TopLevelModel", "Employee")`{ id }`());

export const topLevelQuery = gql.default(({ query }) =>
  query("TopLevelQuery")`($userId: ID!) { employee(id: $userId) { id } }`(),
);
