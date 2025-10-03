import { gql } from "@/graphql-system";
import { cartModel } from "./cart-entity";

export const cartUpdatedSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.cartUpdated({ userId: $.userId }, () => ({
        ...cartModel.fragment(),
      })),
    }),
  ),
);
