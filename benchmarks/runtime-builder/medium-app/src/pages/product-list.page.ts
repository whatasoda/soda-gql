import { gql } from "@/graphql-system";
import { productSlice } from "../entities/product";

export const productListQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...productSlice.fragment(),
  })),
);
