import { gql } from "@/graphql-system";
import { createOrderSlice } from "../entities/order";

export const createOrderMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreateOrder",
      variables: [
        $("userId").scalar("ID:!"),
        $("items").scalar("[OrderItemInput!]:!"),
        $("shippingAddressId").scalar("ID:!"),
        $("billingAddressId").scalar("ID:!"),
        $("notes").scalar("String:?"),
      ],
    },
    ({ $ }) => ({
      order: createOrderSlice.build({
        userId: $.userId,
        items: $.items,
        shippingAddressId: $.shippingAddressId,
        billingAddressId: $.billingAddressId,
        notes: $.notes,
      }),
    }),
  ),
);
