import { gql } from "../../../graphql-system";

/**
 * Operation with async metadata factory.
 *
 * This fixture tests that async metadata is properly resolved
 * when running in a VM sandbox (builder context).
 *
 * Note: setTimeout is not available in VM sandbox, so we use
 * Promise.resolve() chain to simulate async behavior.
 */
export const asyncMetadataQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "AsyncMetadataQuery",
    variables: { ...$var("id").ID("!") },
    metadata: async () => {
      // Use Promise.resolve() chain (setTimeout not available in VM sandbox)
      await Promise.resolve();
      return { asyncKey: "asyncValue", timestamp: 12345 };
    },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);
