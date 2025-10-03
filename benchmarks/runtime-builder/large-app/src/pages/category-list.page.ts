import { gql } from "@/graphql-system";
import { categorySlice } from "../entities/category";

export const categoryListQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...categorySlice.fragment(),
  })),
);
