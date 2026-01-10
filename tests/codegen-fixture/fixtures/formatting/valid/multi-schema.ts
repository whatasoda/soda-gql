import { gql } from "../../graphql-system";

// Multi-schema: admin schema (should be formatted)
export const adminFragment = gql.admin(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }));

// Multi-schema: default schema (should still work)
export const defaultQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetData",
    fields: ({ f }) => ({ ...f.users({})(({ f }) => ({ ...f.id() })) }),
  }),
);

// Multi-schema: nested selections (Post only has id, title, body - no nested fields)
export const nestedAdmin = gql.admin(({ fragment }) =>
  fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title(), ...f.body() }) }),
);
