import { gql } from "../../../../../graphql-system";

/**
 * User fragment
 */
export const simpleUserFragment = gql.default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);

/**
 * Post fragment
 */
export const simplePostFragment = gql.default(({ fragment }) =>
  fragment.Task({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }),
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
