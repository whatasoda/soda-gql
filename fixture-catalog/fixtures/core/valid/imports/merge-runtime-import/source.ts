import type { RuntimeFragmentInput } from "@soda-gql/core/runtime";
import { gql } from "../../../../../graphql-system";

// Test case: File with gql code and existing runtime import
// Expected: gql import removed, gqlRuntime merged into existing runtime import

export const userFragment = gql.default(({ fragment }) => fragment`fragment UserFragment on Employee { id }`());

export type FragmentInput = RuntimeFragmentInput;
