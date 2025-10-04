import { gql } from "@/graphql-system";
import { createProductSlice } from "../entities/product";

export const createProductMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreateProduct",
      variables: {
        ...$("name").scalar("String:!"),
        ...$("description").scalar("String:?"),
        ...$("price").scalar("Float:!"),
        ...$("sku").scalar("String:!"),
        ...$("stockQuantity").scalar("Int:!"),
        ...$("categoryId").scalar("ID:!"),
        ...$("brandId").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      product: createProductSlice.build({
        name: $.name,
        description: $.description,
        price: $.price,
        sku: $.sku,
        stockQuantity: $.stockQuantity,
        categoryId: $.categoryId,
        brandId: $.brandId,
      }),
    }),
  ),
);
