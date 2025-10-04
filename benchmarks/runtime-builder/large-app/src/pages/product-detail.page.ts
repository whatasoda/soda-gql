import { gql } from "@/graphql-system";
import { productDetailSlice } from "../entities/product";

export const productDetailQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProductDetail",
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      product: productDetailSlice.build({ id: $.id }),
    }),
  ),
);
