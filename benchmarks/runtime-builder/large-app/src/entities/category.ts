import { gql } from "@/graphql-system";

type CategoryModel = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly productCount: number;
};

export const categoryModel = gql.default(({ model }) =>
  model(
    {
      typename: "Category",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.slug(),
      ...f.description(),
      ...f.productCount(),
    }),
    (selection): CategoryModel => ({
      id: selection.id,
      name: selection.name,
      slug: selection.slug,
      description: selection.description,
      productCount: selection.productCount,
    }),
  ),
);

export const categorySlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("parentId").scalar("ID:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.categories({ parentId: $.parentId }, () => ({
        ...categoryModel.fragment(),
      })),
    }),
    ({ select }) => select(["$.categories"], (result) => result.map((data) => data.map((category) => categoryModel.normalize(category)))),
  ),
);
