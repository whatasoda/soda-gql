import { gql } from "@/graphql-system";
import { userSlice, userSliceCatalog } from "../entities/user";
import * as userCatalog from "../entities/user.catalog";

type ProfileQueryVariables = {
  readonly userId: string;
  readonly categoryId?: string;
};

export const profileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!"), $("categoryId").scalar("ID:?")],
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
