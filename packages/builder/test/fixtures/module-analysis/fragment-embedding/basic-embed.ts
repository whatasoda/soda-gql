import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * Basic fragment definition
 */
export const userFragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id(), f.name(), f.email()]));

/**
 * Operation that embeds the fragment
 */
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(() => [userFragment.embed()])],
  ),
);
