import { gql } from "@/graphql-system";

export const UserFields = gql.default(
  ({ fragment }) => fragment("UserFields", "User")`
  { id name email }
`,
);
