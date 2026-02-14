import { gql } from "../../../graphql-system";

// New catalog file to test adding modules
export const catalogFragment = gql.default(({ fragment }) =>
  fragment`fragment CatalogFragment on Project { id title priority }`(),
);

export const catalogOperation = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetCatalog",
    variables: { ...$var("limit").Int("?") },
    fields: ({ f, $ }) => ({ ...f.projects({})(({ f }) => ({ ...f.id(), ...f.title(), ...f.priority() })) }),
  }),
);
