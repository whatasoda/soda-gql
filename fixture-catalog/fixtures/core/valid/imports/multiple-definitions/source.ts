import { gql } from "../../../../../graphql-system";

// Test case: File with multiple gql definitions
// Expected: Single runtime import added, all definitions transformed

export const fragment1 = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));

export const fragment2 = gql.default(({ fragment }) => fragment.Task({ fields: ({ f }) => ({ ...f.id() }) }));
