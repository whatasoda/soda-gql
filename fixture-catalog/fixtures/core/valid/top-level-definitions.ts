import { gql } from "../../../graphql-system";

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
  }),
);
