import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const createProductMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("name").scalar("String:!"),
        ...$("description").scalar("String:?"),
        ...$("price").scalar("Float:!"),
        ...$("categoryId").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.createProduct({ input: { name: $.name, description: $.description, price: $.price, categoryId: $.categoryId } }, () => ({
        ...productModel.fragment(),
      })),
    }),
  ),
);
