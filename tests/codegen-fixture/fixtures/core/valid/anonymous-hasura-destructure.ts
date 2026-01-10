import { gql } from "../../graphql-system";

// Pattern simulating user's failing code with operation and destructuring
// Using gql.default instead of gql.hasura (hasura is schema-specific)
// @ts-expect-error - Test fixture for AST parsing, destructuring pattern type doesn't match actual return type
const { useQueryOperation, $infer } = gql
  .default(({ query }) =>
    query.operation({
      name: "ClientProjectListPage_Query",
      variables: {},
      fields: () => ({}),
    }),
  )
  .attach([]);
