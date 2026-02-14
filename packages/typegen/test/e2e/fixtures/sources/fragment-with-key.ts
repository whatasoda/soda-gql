import { gql } from "../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFields on User { id name }`(),
);
