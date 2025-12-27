import { gql } from "../../../codegen-fixture/graphql-system";

// Test duplicate variable names in different scopes
// Each "model" variable should have a unique canonical path
export const model = gql.default(({ fragment }) =>
  fragment.User(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);

function factory() {
  // This "model" variable has a different canonical path than the top-level one
  const model = gql.default(({ fragment }) =>
    fragment.User(
      {},
      ({ f }) => [f.id(), f.name()],
      (selection) => ({ id: selection.id, name: selection.name }),
    ),
  );

  return { model };
}

export { factory };
