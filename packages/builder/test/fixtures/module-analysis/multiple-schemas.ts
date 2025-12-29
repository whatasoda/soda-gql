import { gql } from "../../codegen-fixture/graphql-system";

export const adminFragment = gql.admin(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id(), f.name()] }));

export const defaultQuery = gql.default(({ query }) =>
  query.operation({
    name: "DefaultData",
    fields: ({ f }) => [f.users({})(({ f }) => [f.id()])],
  }),
);
