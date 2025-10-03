import { gql } from "@/graphql-system";

type CategoryModel = {
  readonly id: string;
  readonly name: string;
};

export const categoryModel = gql.default(({ model }) =>
  model(
    {
      typename: "Category",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
    (selection): CategoryModel => ({
      id: selection.id,
      name: selection.name,
    }),
  ),
);

export const categorySlice = gql.default(({ slice }) =>
  slice.query(
    {},
    ({ f }) => ({
      ...f.categories(() => ({
        ...categoryModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.categories"], (result) => result.map((data) => data.map((category) => categoryModel.normalize(category)))),
  ),
);
