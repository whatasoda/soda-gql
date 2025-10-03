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
        ...$("categoryId").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      product: createProductSlice.build({ name: $.name, description: $.description, price: $.price, categoryId: $.categoryId }),
    }),
  ),
);
