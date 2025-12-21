import { gql } from "../../../codegen-fixture/graphql-system";

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("id").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

export const postsSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("limit").scalar("Int:?")] },
    ({ f, $ }) => [f.posts({ limit: $.limit })(({ f }) => [f.id(), f.title()])],
    ({ select }) => select(["$.posts"], (result) => result),
  ),
);
