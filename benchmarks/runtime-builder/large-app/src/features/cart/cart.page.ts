import { gql } from "@/graphql-system";
import { cartSlice } from "./cart-entity";

export const cartQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...cartSlice.fragment(),
  })),
);
