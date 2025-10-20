import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSliceCatalog } from "../entities/user";

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalog: userSliceCatalog.byId.build({ id: $.userId }),
    }),
  ),
);
