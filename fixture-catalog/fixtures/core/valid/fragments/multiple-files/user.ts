import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment on Employee { id name email }`(),
);
