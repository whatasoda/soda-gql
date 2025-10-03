import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const productListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      variables: {
        ...$("categoryId").scalar("ID:?"),
        ...$("brandId").scalar("ID:?"),
        ...$("limit").scalar("Int:?"),
        ...$("offset").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.products({ categoryId: $.categoryId, brandId: $.brandId, priceRange: null, limit: $.limit, offset: $.offset }, ({ f }) => ({
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
  ),
);
