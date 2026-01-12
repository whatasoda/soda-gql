import { gql } from "../../../../../graphql-system";

/**
 * Basic fragment definition
 */
export const userFragment = gql.default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name(), ...f.email() }) }),
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
