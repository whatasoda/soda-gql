import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * User fragment
 */
export const simpleUserFragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id(), f.name()]));

/**
 * Post fragment
 */
export const simplePostFragment = gql.default(({ fragment }) => fragment.Post({}, ({ f }) => [f.id(), f.title()]));

/**
 * Operation that embeds multiple fragments in different fields
 */
export const getDashboardQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetDashboard",
      variables: [$var("userId").scalar("ID:!"), $var("postLimit").scalar("Int:?")],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(() => [simpleUserFragment.embed()]),
      f.posts({ limit: $.postLimit })(() => [simplePostFragment.embed()]),
    ],
  ),
);
