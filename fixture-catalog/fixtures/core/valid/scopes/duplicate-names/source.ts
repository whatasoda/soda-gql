import { gql } from "../../../../../graphql-system";

// Test duplicate variable names in different scopes
// Each "model" variable should have a unique canonical path
export const model = gql.default(({ fragment }) => fragment`fragment Model on Employee { id }`());

function factory() {
  // This "model" variable has a different canonical path than the top-level one
  const model = gql.default(({ fragment }) => fragment`fragment InnerModel on Employee { id name }`());

  return { model };
}

export { factory };
