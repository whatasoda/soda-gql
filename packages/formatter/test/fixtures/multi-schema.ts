import { gql } from "@/graphql-system";

// Multi-schema: admin schema (should be formatted)
export const adminFragment = gql.admin(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id(), f.name()] }));

// Multi-schema: default schema (should still work)
export const defaultQuery = gql.default(({ query }) =>
  query.operation({ name: "GetData", fields: ({ f }) => [f.users({})(({ f }) => [f.id()])] }),
);

// Multi-schema: nested selections
export const nestedAdmin = gql.admin(({ model }) =>
  model.Post({ fields: ({ f }) => [f.id(), f.author()(({ f }) => [f.id(), f.name()])] }),
);
