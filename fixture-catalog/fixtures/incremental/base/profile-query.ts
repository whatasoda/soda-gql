import { gql } from "../../../graphql-system";
import { usersQuery, usersQueryCatalog } from "./user";
import * as userCatalog from "./user-catalog";

type ProfileQueryVariables = {
  readonly employeeId: string;
};

export const profileQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("employeeId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(({ f }) => ({ ...f.id(), ...f.name(), ...f.email() })),
    }),
  }),
);

export type ProfileQuery = typeof profileQuery;
export type ProfileQueryVariablesInput = ProfileQueryVariables;
