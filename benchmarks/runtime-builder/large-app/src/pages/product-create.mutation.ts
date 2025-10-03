import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const createProductMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
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
    ({ f, $ }) => ({
      ...f.createProduct({
        input: {
          name: $.name,
          description: $.description,
          price: $.price,
          sku: $.sku,
          stockQuantity: $.stockQuantity,
          categoryId: $.categoryId,
          brandId: $.brandId,
          images: null,
          attributes: null,
        },
      }, () => ({
        ...productModel.fragment(),
      })),
    }),
  ),
);
