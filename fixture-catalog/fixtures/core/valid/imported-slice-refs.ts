import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(() => ({ ...topLevelModel.spread() })) }),
  }),
);
