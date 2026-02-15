import { gql } from "../../../../../graphql-system";

// Test nested scopes (3 levels: function -> object -> property)
function outer() {
  const fragments = {
    user: gql.default(({ fragment }) => fragment`fragment UserFragment on Employee { id }`()),
    product: gql.default(({ fragment }) => fragment`fragment ProductFragment on Project { id }`()),
  };
  return fragments;
}

export { outer };
