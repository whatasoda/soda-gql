import { gql } from "../../../../graphql-system";

export const objectWrapped = {
  fragment: gql.default(({ fragment }) => fragment("ObjectWrappedFragment", "Employee")`{ id }`()),

  query: gql.default(({ query }) =>
    query("ObjectWrappedQuery")`($userId: ID!) { employee(id: $userId) { id } }`(),
  ),

  nested: {
    fragment: gql.default(({ fragment }) => fragment("NestedFragment", "Employee")`{ id }`()),

    query: gql.default(({ query }) =>
      query("ObjectWrappedNestedQuery")`($userId: ID!) { employee(id: $userId) { id } }`(),
    ),
  },
};
