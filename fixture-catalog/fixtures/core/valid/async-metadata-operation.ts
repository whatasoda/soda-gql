import { gql } from "../../../graphql-system";

/**
 * Operation with metadata via tagged template.
 *
 * Metadata is passed directly as a value in the tagged template invocation.
 * (Async metadata factory is a callback builder feature, tested separately in
 * packages/builder/test/integration/async-metadata.test.ts with inline sources.)
 */
export const asyncMetadataQuery = gql.default(({ query }) =>
  query("AsyncMetadataQuery")`($id: ID!) { employee(id: $id) { id name } }`({
    metadata: { asyncKey: "asyncValue", timestamp: 12345 },
  }),
);
