import { gql } from "../../codegen-fixture/graphql-system";

export const topLevelModel = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

export const topLevelQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "TopLevelQuery",
    variables: { ...$var("userId").scalar("ID:!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
  }),
);
