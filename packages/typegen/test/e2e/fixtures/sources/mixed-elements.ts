import { gql } from "../graphql-system";

// Keyed fragment - should appear in PrebuiltTypes
export const keyedFragment = gql.default(({ fragment }) =>
  fragment.User({
    key: "KeyedUserFields",
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);

// Named operation - should appear in PrebuiltTypes
export const namedOperation = gql.default(({ query }) =>
  query.operation({
    name: "GetUsers",
    fields: ({ f }) => ({
      ...f.users()(({ f }) => ({
        ...f.id(),
      })),
    }),
  }),
);
