import { gql } from "../../graphql-system";
import * as topLevel from "../common/top-level";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalogUsers: topLevel.topLevelQuery.embed({
        userId: $.userId,
      }),
    }),
  ),
);
