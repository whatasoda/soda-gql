import { gql } from "@/graphql-system";
import { cartUpdatedSlice } from "./cart-entity";

export const cartUpdatedSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      operationName: "CartUpdated",
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      cart: cartUpdatedSlice.build({ userId: $.userId }),
    }),
  ),
);
