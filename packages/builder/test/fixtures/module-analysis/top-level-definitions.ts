import { gql } from "../../codegen-fixture/graphql-system";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id()])],
  ),
);
