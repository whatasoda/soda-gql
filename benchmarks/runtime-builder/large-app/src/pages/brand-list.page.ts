import { gql } from "@/graphql-system";
import { brandSlice } from "../entities/brand";

export const brandListQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...brandSlice.fragment(),
  })),
);
