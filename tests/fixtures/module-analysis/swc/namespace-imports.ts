import { gql } from "@/graphql-system";
import * as userCatalog from "../entities/user.catalog";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      catalogUsers: userCatalog.collections.byCategory({ categoryId: $.userId }),
    }),
  )
);
