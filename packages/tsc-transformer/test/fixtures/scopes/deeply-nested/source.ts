import { gql } from "../../../codegen-fixture/graphql-system";

// Test nested scopes (3 levels: function -> object -> property)
function outer() {
  const models = {
    user: gql.default(({ fragment }) =>
      fragment.User(
        {},
        ({ f }) => [f.id()],
        (selection) => ({ id: selection.id }),
      ),
    ),
    product: gql.default(({ fragment }) =>
      fragment.Product(
        {},
        ({ f }) => [f.id()],
        (selection) => ({ id: selection.id }),
      ),
    ),
  };
  return models;
}

export { outer };
