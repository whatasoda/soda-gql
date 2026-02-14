import { gql } from "../../../../graphql-system";

export const topLevelModel = gql.default(({ fragment }) => fragment`fragment TopLevelModel on Employee { id }`());

export const topLevelQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "TopLevelQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
  }),
);
