// Invalid pattern: optional chaining on gql
// The gql identifier should be used directly without optional chaining
import { gql } from "../../../../graphql-system";

// This call is invalid - optional chaining not supported
// If gql is undefined, the call would silently return undefined
export const optionalChaining = gql?.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id() }) }),
);
