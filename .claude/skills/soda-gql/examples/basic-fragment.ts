/**
 * Basic Fragment Example
 *
 * A simple fragment selecting fields from a User type.
 * Fragments are reusable field selections that can be spread into operations.
 */
import { gql } from "@/graphql-system";

// Simple fragment selecting basic user fields
export const userFragment = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
      ...f.createdAt(),
    }),
  }),
);

// Extract types from the fragment
type UserFragmentOutput = typeof userFragment.$infer.output;
// { id: string; name: string; email: string; createdAt: Date }
