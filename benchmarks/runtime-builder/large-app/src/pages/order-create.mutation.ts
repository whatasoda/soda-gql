import { gql } from "@/graphql-system";
import { orderModel } from "../entities/order";

export const createOrderMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("items").scalar("[OrderItemInput!]:!"),
        ...$("shippingAddressId").scalar("ID:!"),
        ...$("billingAddressId").scalar("ID:!"),
        ...$("notes").scalar("String:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.createOrder({
        input: {
          userId: $.userId,
          items: $.items,
          shippingAddressId: $.shippingAddressId,
          billingAddressId: $.billingAddressId,
          notes: $.notes,
        },
      }, () => ({
        ...orderModel.fragment(),
      })),
    }),
  ),
);
