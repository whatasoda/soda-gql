import { gql } from "../../../graphql-system";

// Tagged template - should be formatted when formatTaggedTemplates enabled
export const query1 = gql.default(({ query }) =>
  query("GetUsers")`{ employees { id name } }`
);

// Callback builder - should always be formatted (newline after brace)
export const query2 = gql.default(({ query }) =>
  query("GetUser")({
    fields: ({ f }) => ({ ...f("id")(), ...f("name")() }),
  })(),
);
