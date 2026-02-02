import { gql } from "@/graphql-system";

export const UserFields = gql.default(
  ({ fragment }) => fragment`
  fragment UserFields on User { id name email }
`,
);
