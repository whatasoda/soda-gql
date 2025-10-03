import { gql } from "@/graphql-system";
import { cartModel } from "./cart-entity";

export const addToCartMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("productId").scalar("ID:!"),
        ...$("quantity").scalar("Int:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.addToCart({ input: { userId: $.userId, productId: $.productId, quantity: $.quantity } }, () => ({
        ...cartModel.fragment(),
      })),
    }),
  ),
);
