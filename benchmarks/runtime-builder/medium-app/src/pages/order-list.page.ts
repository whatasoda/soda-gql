import { gql } from "@/graphql-system";
import { orderSlice } from "../entities/order";

export const orderListQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...orderSlice.fragment(),
  })),
);
