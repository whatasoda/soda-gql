import { gql } from "../../../codegen-fixture/graphql-system";

// New catalog file to test adding modules
export const catalogModel = gql.default(({ model }) =>
  model.Product({}, ({ f }) => [
    f.id(),
    f.name(),
    f.price(),
  ]),
);

export const catalogOperation = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      operationName: "GetCatalog",
      variables: [$var("limit").scalar("Int:?")],
    },
    ({ f, $ }) => [
      f.products({ limit: $.limit })(({ f }) => [
        f.id(),
        f.name(),
        f.price(),
      ]),
    ],
  ),
);
