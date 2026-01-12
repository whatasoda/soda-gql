import { gql } from "../../../../graphql-system";

export const objectWrapped = {
  fragment: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),

  query: gql.default(({ query, $var }) =>
    query.operation({
      name: "ObjectWrappedQuery",
      variables: { ...$var("userId").ID("!") },
      fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
    }),
  ),

  nested: {
    fragment: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),

    query: gql.default(({ query, $var }) =>
      query.operation({
        name: "ObjectWrappedNestedQuery",
        variables: { ...$var("userId").ID("!") },
        fields: ({ f, $ }) => ({ ...f.employee({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
      }),
    ),
  },
};
