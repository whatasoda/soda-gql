import { gql } from "../../../../graphql-system";

export const topLevelModel = gql.default(({ fragment }) => fragment`fragment TopLevelModel on Employee { id }`());

export const topLevelQuery = gql.default(({ query }) =>
  query`query TopLevelQuery($userId: ID!) { employee(id: $userId) { id } }`(),
);
