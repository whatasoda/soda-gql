import { gql } from "../../../codegen-fixture/graphql-system";

export const listUsersQuery = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "ListUsers",
    },
    () => ({}),
  ),
);
