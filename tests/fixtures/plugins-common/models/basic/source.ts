import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id(), f.name()],
    (selection) => ({ id: selection.id, name: selection.name }),
  ),
);

export const productModel = gql.default(({ model }) => {
  return model.Product(
    {},
    ({ f }) => [f.id(), f.name()],
    (selection) => ({ id: selection.id, name: selection.name }),
  );
});

export const models = {
  user: gql.default(({ model }) =>
    model.User(
      {},
      ({ f }) => [f.id()],
      (selection) => ({ id: selection.id }),
    ),
  ),
};
