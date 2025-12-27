import type { RuntimeModelInput } from "@soda-gql/core/runtime";
import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with gql code and existing runtime import
// Expected: gql import removed, gqlRuntime merged into existing runtime import

export const userModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));

export type ModelInput = RuntimeModelInput;
