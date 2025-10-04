import { gql } from "@/graphql-system";
import { productSearchSlice } from "../entities/product";

export const productSearchQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProductSearch",
      variables: [
        $("query").scalar("String:!"),
        $("limit").scalar("Int:?"),
        $("offset").scalar("Int:?"),
      ],
    },
    ({ $ }) => ({
      searchResults: productSearchSlice.build({
        query: $.query,
        limit: $.limit,
        offset: $.offset,
      }),
    }),
  ),
);
