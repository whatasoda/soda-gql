import { gql } from "@/graphql-system";
import { orderModel } from "../entities/order";

export const orderDetailQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ f, $ }) => ({
      ...f.order({ id: $.id }, () => ({
        ...orderModel.fragment(),
      })),
    }),
  ),
);
