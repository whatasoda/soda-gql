import { gql } from "@/graphql-system";
import { productListSlice } from "../entities/product";

export const productListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProductList",
      variables: [
        $("categoryId").scalar("ID:?"),
        $("brandId").scalar("ID:?"),
        $("limit").scalar("Int:?"),
        $("offset").scalar("Int:?"),
      ],
    },
    ({ $ }) => ({
      products: productListSlice.build({
        categoryId: $.categoryId,
        brandId: $.brandId,
        limit: $.limit,
        offset: $.offset,
      }),
    }),
  ),
);
