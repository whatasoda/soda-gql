import { gql } from "@/graphql-system";
import { createOrderSlice } from "../entities/order";

export const createOrderMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreateOrder",
      variables: {
        ...$("userId").scalar("ID:!"),
        ...$("items").scalar("[OrderItemInput!]:!"),
      },
    },
    ({ $ }) => ({
      order: createOrderSlice.build({ userId: $.userId, items: $.items }),
    }),
  ),
);
