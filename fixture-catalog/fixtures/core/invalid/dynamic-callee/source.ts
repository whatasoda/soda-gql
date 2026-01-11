// Invalid pattern: dynamic callee expression
// The callee must be a simple identifier, not a complex expression
import { gql } from "../../../../graphql-system";

const altGql = null;

// This call is invalid - dynamic expression as callee
export const dynamicCallee = (altGql || gql).default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);

// Conditional expression is also not supported
const useAlt = false;
// @ts-expect-error - intentionally invalid: altGql is null
export const conditionalCallee = (useAlt ? altGql : gql).default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }),
);
