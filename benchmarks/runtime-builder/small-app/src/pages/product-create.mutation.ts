import { gql } from "@/graphql-system";
import { createProductSlice } from "../entities/product";

export const createProductMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreateProduct",
      variables: [$("name").scalar("String:!"), $("price").scalar("Float:!")],
    },
    ({ $ }) => ({
      product: createProductSlice.build({ name: $.name, price: $.price }),
    }),
  ),
);
