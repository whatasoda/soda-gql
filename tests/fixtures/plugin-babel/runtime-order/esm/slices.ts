import { gql } from "@/graphql-system";

export const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("userId").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);
