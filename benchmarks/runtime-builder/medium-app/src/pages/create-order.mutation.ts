import { gql } from "@/graphql-system";
import { orderModel } from "../entities/order";

export const createOrderMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("items").scalar("[OrderItemInput!]:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.createOrder({ userId: $.userId, items: $.items }, () => ({
        ...orderModel.fragment(),
      })),
    }),
  ),
);
