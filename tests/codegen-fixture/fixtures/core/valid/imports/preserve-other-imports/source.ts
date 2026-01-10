import type { AnyGraphqlSchema } from "@soda-gql/core";
import { gql } from "../../../../graphql-system";

// Test case: File with gql code and other imports
// Expected: gql import removed, runtime import added, other imports preserved

export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

export const schema: AnyGraphqlSchema = {} as AnyGraphqlSchema;
