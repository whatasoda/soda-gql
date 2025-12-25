import { gql } from "../../codegen-fixture/graphql-system";

export const adminModel = gql.admin(({ model }) =>
  model.User({}, ({ f }) => [f.id(), f.name()]),
);

export const defaultQuery = gql.default(({ query }) =>
  query.operation(
    {
      name: "DefaultData",
    },
    ({ f }) => [f.users({})(({ f }) => [f.id()])],
  ),
);
