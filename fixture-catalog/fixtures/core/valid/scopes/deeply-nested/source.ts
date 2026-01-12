import { gql } from "../../../../../graphql-system";

// Test nested scopes (3 levels: function -> object -> property)
function outer() {
  const fragments = {
    user: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
    product: gql.default(({ fragment }) => fragment.Project({ fields: ({ f }) => ({ ...f.id() }) })),
  };
  return fragments;
}

export { outer };
