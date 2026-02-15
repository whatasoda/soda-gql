import { gql } from "../../../../../graphql-system";

/**
 * Basic fragment definition
 */
export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment on Employee { id name email }`(),
);

/**
 * Operation that spreads the fragment
 */
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(() => ({ ...userFragment.spread() })) }),
  }),
);
