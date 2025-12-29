import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: Fragment definitions in separate file
// Used by operations.ts to test cross-file transformation order

export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id(), f.name()] }));
