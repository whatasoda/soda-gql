import { gql } from "../../../../../graphql-system";

// Test case: Fragment definitions in separate file
// Used by operations.ts to test cross-file transformation order

export const userFragment = gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id name }`());
