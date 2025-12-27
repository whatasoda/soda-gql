import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: Model definitions in separate file
// Used by operations.ts to test cross-file transformation order

export const userModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name()]));
