import { gql } from "@/graphql-system";

// New catalog file to test adding modules
export const catalogSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("limit").scalar("Int:?")],
    },
    ({ f, $ }) => [
      //
      f.products({ limit: $.limit })(({ f }) => [
        //
        f.id(),
        f.name(),
        f.price(),
      ]),
    ],
    ({ select }) => select(["$.products"], (result) => result),
  ),
);

export const catalogOperation = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "GetCatalog",
      variables: [$("limit").scalar("Int:?")],
    },
    ({ $ }) => ({
      products: catalogSlice.embed({ limit: $.limit }),
    }),
  ),
);
