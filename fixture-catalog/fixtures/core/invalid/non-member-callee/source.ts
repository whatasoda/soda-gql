// Invalid pattern: calling gql directly without property access
// Must use gql.schemaName() pattern, not gql()
import { gql } from "../../../../graphql-system";

// This call is invalid - gql must be accessed as gql.schemaName(...)
// @ts-expect-error - intentionally invalid for testing
export const userFragment = gql(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);
