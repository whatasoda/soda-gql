import { gql } from "../../../graphql-system";

// New catalog file to test adding modules
export const catalogFragment = gql.default(({ fragment }) =>
  fragment("CatalogFragment", "Project")`{ id title priority }`(),
);

export const catalogOperation = gql.default(({ query }) =>
  query("GetCatalog")`($limit: Int) { projects { id title priority } }`(),
);
