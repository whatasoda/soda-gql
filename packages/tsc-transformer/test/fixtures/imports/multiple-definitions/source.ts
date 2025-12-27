import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with multiple gql definitions
// Expected: Single runtime import added, all definitions transformed

export const model1 = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));

export const model2 = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id()]));
