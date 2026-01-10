import { gql } from "../../graphql-system";
import { usersQuery, usersQueryCatalog } from "./user";
import * as userCatalog from "./user-catalog";

type ProfileQueryVariables = {
  readonly userId: string;
  readonly categoryId?: string;
};

export const profileQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!"), ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.users({
        id: [$.userId],
        categoryId: $.categoryId,
      })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);

export type ProfileQuery = typeof profileQuery;
export type ProfileQueryVariablesInput = ProfileQueryVariables;
