import { gql } from "../../../graphql-system";
import { objectWrapped } from "./common/object-wrapped";

export const pageQuery = gql.default(({ query }) =>
  query("ProfilePageQuery")({
    variables: `($userId: ID!)`,
    fields: ({ f, $ }) => ({ ...f("employee", { id: $.userId })(() => ({ ...objectWrapped.fragment.spread() })) }),
  })(),
);
