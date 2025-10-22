import { gql } from "@/graphql-system";

export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("id").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name(), f.email()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

export const postsSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("limit").scalar("Int:?")] },
    ({ f, $ }) => [f.posts({ limit: $.limit })(({ f }) => [f.id(), f.title()])],
    ({ select }) => select(["$.posts"], (result) => result),
  ),
);
