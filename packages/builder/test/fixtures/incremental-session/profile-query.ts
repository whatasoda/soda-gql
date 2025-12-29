import { gql } from "../../codegen-fixture/graphql-system";
import { usersQuery, usersQueryCatalog } from "./user";
import * as userCatalog from "./user-catalog";

type ProfileQueryVariables = {
  readonly userId: string;
  readonly categoryId?: string;
};

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").scalar("ID:!"), ...$var("categoryId").scalar("ID:?") },
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
