import { gql } from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => [f.id(), f.name()],
    (selection) => ({ id: selection.id, name: selection.name }),
  ),
);

export const productModel = gql.default(({ model }) => {
  return model(
    { typename: "Product" },
    ({ f }) => [f.id(), f.title()],
    (selection) => ({ id: selection.id, title: selection.title }),
  );
});

export const models = {
  user: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => [f.id()],
      (selection) => ({ id: selection.id }),
    ),
  ),
};

export const complexModel = gql.default(({ model }) =>
  model(
    { typename: "Complex" },
    ({ f }) => [
      f.nested(({ f }) => [
        f.field(),
      ]),
    ],
    (selection) => ({ nested: selection.nested }),
  ),
);
