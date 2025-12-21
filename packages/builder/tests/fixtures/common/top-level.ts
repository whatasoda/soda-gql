import { gql } from "../../graphql-system";

export const topLevelModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
    ],
    (v) => v,
  ),
);

export const topLevelQuery = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);
