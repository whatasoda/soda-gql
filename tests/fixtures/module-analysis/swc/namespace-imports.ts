import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import * as userCatalog from "../entities/user.catalog";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalogUsers: userCatalog.collections.byCategory.embed({ categoryId: $.userId }),
    }),
  ),
);
