import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import { userSliceCatalog } from "../entities/user";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalog: userSliceCatalog.byId.embed({ id: $.userId }),
    }),
  ),
);
