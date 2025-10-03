import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const createProductMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("name").scalar("String:!"),
        ...$("price").scalar("Float:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.createProduct({ name: $.name, price: $.price }, () => ({
        ...productModel.fragment(),
      })),
    }),
  ),
);
