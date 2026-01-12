import { gql } from "../../../graphql-system";
import * as topLevel from "./common/top-level";

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(() => ({ ...topLevel.topLevelModel.spread() })) }),
  }),
);
