import { gql } from "../../codegen-fixture/graphql-system";

export const collections = {
  byCategory: gql.default(({ query }, { $var }) =>
    query.operation({
      name: "UsersByCategory",
      variables: { ...$var("categoryId").scalar("ID:?") },
      fields: ({ f, $ }) => ({ ...f.users({ categoryId: $.categoryId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  ),
};
