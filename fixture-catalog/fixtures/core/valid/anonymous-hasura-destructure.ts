import { gql } from "../../../graphql-system";

// Pattern simulating user's failing code with operation and destructuring
// Using gql.default instead of gql.hasura (hasura is schema-specific)
const { $infer } = gql
  .default(({ query }) =>
    query`query ClientProjectListPage_Query { __typename }`(),
  )
  .attach([]);
