import { gql } from "@/graphql-system";

// Multi-schema: admin schema (already formatted)
export const adminFragment = gql.admin(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => [
      //
      f.id(),
      f.name(),
    ],
  }),
);

// Multi-schema: default schema (already formatted)
export const defaultQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetData",
    fields: ({ f }) => [
      //
      f.users({})(({ f }) => [
        //
        f.id(),
      ]),
    ],
  }),
);
