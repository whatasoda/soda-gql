import { gql } from "@/graphql-system";
import { productSlice } from "../entities/product";

export const productListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProductList",
      variables: {
        ...$("categoryId").scalar("ID:?"),
        ...$("limit").scalar("Int:?"),
        ...$("offset").scalar("Int:?"),
      },
    },
    ({ $ }) => ({
      products: productSlice.build({ categoryId: $.categoryId, limit: $.limit, offset: $.offset }),
    }),
  ),
);
