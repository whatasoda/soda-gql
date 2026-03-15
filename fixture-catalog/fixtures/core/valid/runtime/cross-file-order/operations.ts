import { gql } from "../../../../../graphql-system";
import { userFragment } from "./slices";

// Test case: Operation that imports fragment from another file
// Tests runtime import handling and transformation order

export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($userId: ID!)`,
    fields: ({ f, $ }) => ({ ...f("employee", { id: $.userId })(() => ({ ...userFragment.spread() })) }),
  })(),
);
