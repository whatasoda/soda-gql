import { gql } from "@/graphql-system";
import { orderDetailSlice } from "../entities/order";

export const orderDetailQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "OrderDetail",
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      order: orderDetailSlice.build({ id: $.id }),
    }),
  ),
);
