import { gql } from "../graphql-system";

// Keyed fragment - should appear in PrebuiltTypes
export const keyedFragment = gql.default(({ fragment }) => fragment`fragment KeyedUserFields on User { id name }`());

// Named operation - should appear in PrebuiltTypes
export const namedOperation = gql.default(({ query }) => query`query GetUsers { users { id } }`());
