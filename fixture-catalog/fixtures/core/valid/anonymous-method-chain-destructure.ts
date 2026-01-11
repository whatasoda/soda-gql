import { gql } from "../../../graphql-system";

// Pattern from actual failing code: gql.xxx(...).attach(...) with destructuring
// @ts-expect-error - Test fixture for AST parsing, destructuring pattern type doesn't match actual return type
const { useQueryOperation, $infer } = gql
  .default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }))
  .attach([]);
