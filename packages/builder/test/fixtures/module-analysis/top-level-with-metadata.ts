import { gql } from "../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.users({ id: [$.userId] })(({ f }) => [f.id()])],
  ),
);
