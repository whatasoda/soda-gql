import { gql } from "../../../graphql-system";

// New catalog file to test adding modules
export const catalogFragment = gql.default(({ fragment }) =>
  fragment`fragment CatalogFragment on Project { id title priority }`(),
);

export const catalogOperation = gql.default(({ query }) =>
  query`query GetCatalog($limit: Int) { projects { id title priority } }`(),
);
