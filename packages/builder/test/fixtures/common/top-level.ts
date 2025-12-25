import { gql } from "../../codegen-fixture/graphql-system";

export const topLevelModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));

export const topLevelQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "TopLevelQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
  ),
);
