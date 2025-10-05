import { gql } from "@/graphql-system";

type ProductModel = {
  readonly id: string;
  readonly name: string;
  readonly price: number;
};

export const productModel = gql.default(({ model }) =>
  model.Product(
    {},
    ({ f }) => [
      f.id(),
      f.name(),
      f.price(),
    ],
    (selection): ProductModel => ({
      id: selection.id,
      name: selection.name,
      price: selection.price,
    }),
  ),
);

export const productSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("limit").scalar("Int:?")],
    },
    ({ f, $ }) => [
      f.products({ limit: $.limit })(() => [
        productModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.products"], (result) => result.map((data) => data.map((product) => productModel.normalize(product)))),
  ),
);

export const createProductSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [$("name").scalar("String:!"), $("price").scalar("Float:!")],
    },
    ({ f, $ }) => [
      f.createProduct({ name: $.name, price: $.price })(() => [
        productModel.fragment(),
      ]),
    ],
    ({ select }) => select(["$.createProduct"], (result) => result.map((data) => productModel.normalize(data))),
  ),
);
