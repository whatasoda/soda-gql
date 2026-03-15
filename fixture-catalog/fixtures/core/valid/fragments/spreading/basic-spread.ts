import { gql } from "../../../../../graphql-system";

/**
 * Basic fragment definition
 */
export const userFragment = gql.default(({ fragment }) =>
  fragment("UserFragment", "Employee")`{ id name email }`(),
);

/**
 * Operation that spreads the fragment
 */
export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($userId: ID!)`,
    fields: ({ f, $ }) => ({ ...f("employee", { id: $.userId })(() => ({ ...userFragment.spread() })) }),
  })(),
);
