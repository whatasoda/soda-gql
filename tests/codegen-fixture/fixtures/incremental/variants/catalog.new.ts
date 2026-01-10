import { gql } from "../../../graphql-system";

// New catalog file to test adding modules
export const catalogFragment = gql.default(({ fragment }) =>
  fragment.Product({ fields: ({ f }) => ({ ...f.id(), ...f.name(), ...f.price() }) }),
);

export const catalogOperation = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetCatalog",
    variables: { ...$var("limit").Int("?") },
    fields: ({ f, $ }) => ({ ...f.products({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name(), ...f.price() })) }),
  }),
);
