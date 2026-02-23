import { gql } from "../graphql-system";

// Keyed fragment - should appear in PrebuiltTypes
export const keyedFragment = gql.default(({ fragment }) => fragment("KeyedUserFields", "User")`{ id name }`());

// Named operation - should appear in PrebuiltTypes
export const namedOperation = gql.default(({ query }) => query("GetUsers")`{ users { id } }`());
