import { gql } from "@/graphql-system";
import { categorySlice } from "../entities/category";

export const categoryListQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "CategoryList",
      variables: [$("parentId").scalar("ID:?")],
    },
    ({ $ }) => ({
      categories: categorySlice.build({ parentId: $.parentId }),
    }),
  ),
);
