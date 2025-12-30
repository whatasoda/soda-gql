import { gql } from "../../../codegen-fixture/graphql-system";
import { userFragment } from "./slices";

// Test case: Operation that imports fragment from another file
// Tests runtime import handling and transformation order

export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(() => ({ ...userFragment.spread() })) }),
  }),
);
