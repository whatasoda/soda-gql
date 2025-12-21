import { gql } from "@/graphql-system";

export const listUsersQuery = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "ListUsers",
    },
    () => ({}),
  ),
);
