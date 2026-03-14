import { gql } from "../../../../../graphql-system";

/**
 * User fragment
 */
export const simpleUserFragment = gql.default(({ fragment }) =>
  fragment("SimpleUserFragment", "Employee")`{ id name }`(),
);

/**
 * Post fragment
 */
export const simplePostFragment = gql.default(({ fragment }) =>
  fragment("SimplePostFragment", "Task")`{ id title }`(),
);

/**
 * Operation that spreads multiple fragments in different fields
 */
export const getDashboardQuery = gql.default(({ query }) =>
  query("GetDashboard")({
    variables: `($userId: ID!, $postLimit: Int)`,
    fields: ({ f, $ }) => ({
      ...f("employee", { id: $.userId })(() => ({ ...simpleUserFragment.spread() })),
      ...f("tasks", { limit: $.postLimit })(() => ({ ...simplePostFragment.spread() })),
    }),
  })(),
);
