import { gql } from "@/graphql-system";

// New catalog file to test adding modules
export const catalogSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
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

export const catalogOperation = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "GetCatalog",
      variables: [$("limit").scalar("Int:?")],
    },
    ({ $ }) => ({
      products: catalogSlice.build({ limit: $.limit }),
    }),
  ),
);
