import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with multiple gql definitions
// Expected: Single runtime import added, all definitions transformed

export const fragment1 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] }));

export const fragment2 = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => [f.id()] }));
