import { gql } from "../../../graphql-system";

export const adminFragment = gql.admin(({ fragment }) => fragment`fragment AdminFragment on Employee { id name }`());

export const defaultQuery = gql.default(({ query }) =>
  query`query DefaultData { employees { id } }`(),
);
