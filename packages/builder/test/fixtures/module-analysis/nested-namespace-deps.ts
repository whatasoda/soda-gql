import { gql } from "../../codegen-fixture/graphql-system";
import { objectWrapped } from "../common/object-wrapped";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ f, $ }) => [f.user({ id: $.userId })(() => [objectWrapped.nested.fragment.embed()])],
  }),
);
