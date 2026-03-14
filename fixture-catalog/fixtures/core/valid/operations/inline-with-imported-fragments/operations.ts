import { gql } from "../../../../../graphql-system";
import { userFragment } from "./fragments";

export const getUserById = gql.default(({ query }) =>
  query("GetUserById")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("employee", { id: $.id })(() => ({
        ...userFragment.spread(),
      })),
    }),
  })(),
);
