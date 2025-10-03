import { gql } from "@/graphql-system";

type CategoryModel = {
  readonly id: string;
  readonly name: string;
};

type ProductModel = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly category: CategoryModel;
};

export const categoryFragment = gql.default(({ model }) =>
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

export const productModel = gql.default(({ model }) =>
  model(
    {
      typename: "Product",
    },
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.description(),
      ...f.price(),
      ...f.category(() => ({
        ...categoryFragment.fragment(),
      })),
    }),
    (selection): ProductModel => ({
      id: selection.id,
      name: selection.name,
      description: selection.description,
      price: selection.price,
      category: categoryFragment.normalize(selection.category),
    }),
  ),
);

export const productSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: {
        ...$("categoryId").scalar("ID:?"),
        ...$("limit").scalar("Int:?"),
        ...$("offset").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.products({ categoryId: $.categoryId, limit: $.limit, offset: $.offset }, ({ f }) => ({
        ...f.edges(({ f }) => ({
          ...f.node(() => ({
            ...productModel.fragment(),
          })),
          ...f.cursor(),
        })),
        ...f.pageInfo(({ f }) => ({
          ...f.hasNextPage(),
          ...f.hasPreviousPage(),
          ...f.startCursor(),
          ...f.endCursor(),
        })),
        ...f.totalCount(),
      })),
    }),
    ({ select }) => select(["$.products"], (result) => result.map((data) => ({
      products: data.edges.map((edge) => productModel.normalize(edge.node)),
      pageInfo: data.pageInfo,
      totalCount: data.totalCount,
    }))),
  ),
);
