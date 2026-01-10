import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with gql code but no existing runtime import
// Expected: gqlRuntime import/require should be added

export const simpleFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
