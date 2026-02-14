import { gql } from "../../../../../graphql-system";

/**
 * User fragment
 */
export const simpleUserFragment = gql.default(({ fragment }) =>
  fragment`fragment SimpleUserFragment on Employee { id name }`(),
);

/**
 * Post fragment
 */
export const simplePostFragment = gql.default(({ fragment }) =>
  fragment`fragment SimplePostFragment on Task { id title }`(),
);

/**
 * Operation that spreads multiple fragments in different fields
 */
export const getDashboardQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetDashboard",
    variables: { ...$var("userId").ID("!"), ...$var("postLimit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.userId })(() => ({ ...simpleUserFragment.spread() })),
      ...f.tasks({ limit: $.postLimit })(() => ({ ...simplePostFragment.spread() })),
    }),
  }),
);
