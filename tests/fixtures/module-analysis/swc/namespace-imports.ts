import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import * as userCatalog from "../entities/user.catalog";

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalogUsers: userCatalog.collections.byCategory.build({ categoryId: $.userId }),
    }),
  ),
);
