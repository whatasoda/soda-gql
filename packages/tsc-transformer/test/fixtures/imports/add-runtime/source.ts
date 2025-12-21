import { gql } from "../../../codegen-fixture/graphql-system";

// Test case: File with gql code but no existing runtime import
// Expected: gqlRuntime import/require should be added

export const simpleModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);
