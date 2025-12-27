import type { AnyGraphqlSchema } from "@soda-gql/core";
import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with gql code and other imports
// Expected: gql import removed, runtime import added, other imports preserved

export const userModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));

export const schema: AnyGraphqlSchema = {} as AnyGraphqlSchema;
