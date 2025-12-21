import { gql } from "../../graphql-system";
import { topLevelQuery } from "../common/top-level";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      users: topLevelQuery.embed({ userId: $.userId }),
    }),
  ),
);
