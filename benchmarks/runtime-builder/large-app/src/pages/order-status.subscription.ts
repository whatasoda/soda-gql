import { gql } from "@/graphql-system";
import { orderStatusSlice } from "../entities/order";

export const orderStatusSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      operationName: "OrderStatus",
      variables: [
        $("userId").scalar("ID:!"),
      ],
    },
    ({ $ }) => ({
      order: orderStatusSlice.build({ userId: $.userId }),
    }),
  ),
);
