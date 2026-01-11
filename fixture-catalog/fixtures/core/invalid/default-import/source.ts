// Invalid pattern: default import
// The graphql-system module exports gql as a named export, not default
// @ts-expect-error - intentionally invalid for testing
import gql from "../../../../graphql-system";

// This will NOT work because gql is not exported as default
export const userFragment = gql.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);
