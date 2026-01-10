import { gql } from "../../graphql-system";

export const collections = {
  byCategory: gql.default(({ query, $var }) =>
    query.operation({
      name: "UsersByCategory",
      variables: { ...$var("categoryId").ID("?") },
      fields: ({ f, $ }) => ({ ...f.users({ categoryId: $.categoryId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  ),
};
