import { gql } from "../../../codegen-fixture/graphql-system";

export const listUsersSlice = gql.default(({ query }) =>
  query.slice(
    {},
    ({ f }) => [f.users({})(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.users"], (result) => result),
  ),
);
