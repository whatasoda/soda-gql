import { gql } from "../../../../../graphql-system";

// Test case: File with multiple gql definitions
// Expected: Single runtime import added, all definitions transformed

export const fragment1 = gql.default(({ fragment }) => fragment`fragment Fragment1 on Employee { id }`());

export const fragment2 = gql.default(({ fragment }) => fragment`fragment Fragment2 on Task { id }`());
