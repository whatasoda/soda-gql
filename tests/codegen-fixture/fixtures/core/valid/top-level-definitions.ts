import { gql } from "../../graphql-system";

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
  }),
);
