import { gql } from "@/graphql-system";

export const UserFields = gql.default(({ fragment }) => fragment`fragment UserFields($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}`);
