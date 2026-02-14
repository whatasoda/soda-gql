import { gql } from "../../../../graphql-system";

export const objectWrapped = {
  fragment: gql.default(({ fragment }) => fragment`fragment ObjectWrappedFragment on Employee { id }`()),

  query: gql.default(({ query, $var }) =>
    query.operation({
      name: "ObjectWrappedQuery",
      variables: { ...$var("userId").ID("!") },
      fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
    }),
  ),

  nested: {
    fragment: gql.default(({ fragment }) => fragment`fragment NestedFragment on Employee { id }`()),

    query: gql.default(({ query, $var }) =>
      query.operation({
        name: "ObjectWrappedNestedQuery",
        variables: { ...$var("userId").ID("!") },
        fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
      }),
    ),
  },
};
