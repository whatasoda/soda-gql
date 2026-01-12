// Invalid pattern: default import
// The graphql-system module exports gql as a named export, not default
// @ts-expect-error - intentionally invalid for testing
import gql from "../../../../graphql-system";

// This will NOT work because gql is not exported as default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userFragment = gql.default(({ fragment }: any) =>
  fragment.Employee({ fields: ({ f }: any) => ({ ...f.id(), ...f.name() }) }),
);
