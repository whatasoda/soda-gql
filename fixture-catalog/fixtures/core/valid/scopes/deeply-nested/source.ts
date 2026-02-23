import { gql } from "../../../../../graphql-system";

// Test nested scopes (3 levels: function -> object -> property)
function outer() {
  const fragments = {
    user: gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id }`()),
    product: gql.default(({ fragment }) => fragment("ProductFragment", "Project")`{ id }`()),
  };
  return fragments;
}

export { outer };
