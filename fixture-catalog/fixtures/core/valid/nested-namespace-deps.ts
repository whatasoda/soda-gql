import { gql } from "../../../graphql-system";
import { objectWrapped } from "./common/object-wrapped";

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(() => ({ ...objectWrapped.nested.fragment.spread() })) }),
  }),
);
