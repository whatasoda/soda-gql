import { gql } from "@/graphql-system";
import { orderSlice } from "../entities/order";

export const orderListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "OrderList",
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("status").scalar("OrderStatus:?"),
      },
    },
    ({ $ }) => ({
      orders: orderSlice.build({ userId: $.userId, status: $.status }),
    }),
  ),
);
