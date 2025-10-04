import { gql } from "@/graphql-system";
import { brandSlice } from "../entities/brand";

export const brandListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "BrandList",
      variables: [
        $("limit").scalar("Int:?"),
      ],
    },
    ({ $ }) => ({
      brands: brandSlice.build({ limit: $.limit }),
    }),
  ),
);
