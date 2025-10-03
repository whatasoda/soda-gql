import { gql } from "@/graphql-system";
import { addToCartSlice } from "./cart-entity";

export const addToCartMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "AddToCart",
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("productId").scalar("ID:!"),
        ...$("quantity").scalar("Int:!"),
      },
    },
    ({ $ }) => ({
      cart: addToCartSlice.build({ userId: $.userId, productId: $.productId, quantity: $.quantity }),
    }),
  ),
);
