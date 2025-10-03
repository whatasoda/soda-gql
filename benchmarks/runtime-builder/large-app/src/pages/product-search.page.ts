import { gql } from "@/graphql-system";
import { productModel } from "../entities/product";

export const productSearchQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      variables: {
        ...$("query").scalar("String:!"),
        ...$("limit").scalar("Int:?"),
      },
    },
    ({ f, $ }) => ({
      ...f.searchProducts({ query: $.query, limit: $.limit }, () => ({
        ...productModel.fragment(),
      })),
    }),
  ),
);
