import { gql } from "@/graphql-system";
import { orderModel } from "../entities/order";

export const orderStatusSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.orderStatusChanged({ userId: $.userId }, () => ({
        ...orderModel.fragment(),
      })),
    }),
  ),
);
