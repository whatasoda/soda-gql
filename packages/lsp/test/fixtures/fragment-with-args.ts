import { gql } from "@/graphql-system";

export const UserFields = gql.default(
  ({ fragment }) => fragment("UserFields", "User")`($showEmail: Boolean = false) {
  id
  name
  email @include(if: $showEmail)
}`,
);
