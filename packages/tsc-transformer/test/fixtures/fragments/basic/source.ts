import { gql } from "../../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User(
    {},
    ({ f }) => [f.id(), f.name()],
    (selection) => ({ id: selection.id, name: selection.name }),
  ),
);

export const productFragment = gql.default(({ fragment }) => {
  return fragment.Product(
    {},
    ({ f }) => [f.id(), f.name()],
    (selection) => ({ id: selection.id, name: selection.name }),
  );
});

export const models = {
  user: gql.default(({ fragment }) =>
    fragment.User(
      {},
      ({ f }) => [f.id()],
      (selection) => ({ id: selection.id }),
    ),
  ),
};
