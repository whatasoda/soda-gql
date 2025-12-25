import { gql } from "../../codegen-fixture/graphql-system";
import { objectWrapped } from "../common/object-wrapped";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      catalog: objectWrapped.query.embed({ userId: $.userId }),
    }),
  ),
);
