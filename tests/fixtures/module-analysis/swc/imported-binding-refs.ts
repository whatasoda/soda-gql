import { gql } from "@/graphql-system";
import { userSliceCatalog } from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      catalog: userSliceCatalog.byId({ id: $.userId }),
    }),
  )
);
