import { gql } from "../../codegen-fixture/graphql-system";
import * as topLevel from "../common/top-level";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalogUsers: topLevel.topLevelQuery.embed({
        userId: $.userId,
      }),
    }),
  ),
);
