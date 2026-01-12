import { gql } from "../../../../../graphql-system";
import { userFragment } from "./fragments";

export const getUserById = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUserById",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.id })(() => ({
        ...userFragment.spread(),
      })),
    }),
  }),
);
