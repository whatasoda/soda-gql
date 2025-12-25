import { gql } from "../../../../../tests/codegen-fixture/graphql-system";

export const collections = {
  byCategory: gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "UsersByCategory",
        variables: [$var("categoryId").scalar("ID:?")],
      },
      ({ f, $ }) => [f.users({ categoryId: $.categoryId })(({ f }) => [f.id(), f.name()])],
    ),
  ),
};
