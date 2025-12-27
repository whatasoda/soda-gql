import { gql } from "../../../codegen-fixture/graphql-system";

// Test nested scopes (3 levels: function -> object -> property)
function outer() {
  const fragments = {
    user: gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()])),
    product: gql.default(({ fragment }) => fragment.Product({}, ({ f }) => [f.id()])),
  };
  return fragments;
}

export { outer };
