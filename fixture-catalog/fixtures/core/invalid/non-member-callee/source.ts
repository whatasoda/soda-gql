// Invalid pattern: calling gql directly without property access
// Must use gql.schemaName() pattern, not gql()
import { gql } from "../../../../graphql-system";

// This call is invalid - gql must be accessed as gql.schemaName(...)
// @ts-expect-error - intentionally invalid for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userFragment = gql(({ fragment }: any) =>
  fragment.User({ fields: ({ f }: any) => ({ ...f.id(), ...f.name() }) }),
);
