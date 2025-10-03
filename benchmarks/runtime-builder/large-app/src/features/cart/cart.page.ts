import { gql } from "@/graphql-system";
import { cartSlice } from "./cart-entity";

export const cartQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "Cart",
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      cart: cartSlice.build({ userId: $.userId }),
    }),
  ),
);
