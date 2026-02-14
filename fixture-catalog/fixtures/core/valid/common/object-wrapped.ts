import { gql } from "../../../../graphql-system";

export const objectWrapped = {
  fragment: gql.default(({ fragment }) => fragment`fragment ObjectWrappedFragment on Employee { id }`()),

  query: gql.default(({ query }) =>
    query`query ObjectWrappedQuery($userId: ID!) { employee(id: $userId) { id } }`(),
  ),

  nested: {
    fragment: gql.default(({ fragment }) => fragment`fragment NestedFragment on Employee { id }`()),

    query: gql.default(({ query }) =>
      query`query ObjectWrappedNestedQuery($userId: ID!) { employee(id: $userId) { id } }`(),
    ),
  },
};
