import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.users({ id: [$.userId] })(({ f }) => ({ ...f.id() })) }),
  }),
);
