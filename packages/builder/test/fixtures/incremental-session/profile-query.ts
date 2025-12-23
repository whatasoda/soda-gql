import { gql } from "../../../../../tests/codegen-fixture/graphql-system";
import { userSlice, userSliceCatalog } from "./user";
import * as userCatalog from "./user-catalog";

type ProfileQueryVariables = {
  readonly userId: string;
  readonly categoryId?: string;
};

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ $ }) => ({
      users: userSlice.embed({
        id: $.userId,
        categoryId: $.categoryId,
      }),
      remoteUsers: userSliceCatalog.byId.embed({
        id: $.userId,
        categoryId: $.categoryId,
      }),
      catalogUsers: userCatalog.collections.byCategory.embed({
        categoryId: $.categoryId,
      }),
    }),
  ),
);

export type ProfileQuery = typeof profileQuery;
export type ProfileQueryVariablesInput = ProfileQueryVariables;
