import { gql } from "../../codegen-fixture/graphql-system";
import { topLevelQuery } from "../common/top-level";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      users: topLevelQuery.embed({ userId: $.userId }),
    }),
  ),
);
