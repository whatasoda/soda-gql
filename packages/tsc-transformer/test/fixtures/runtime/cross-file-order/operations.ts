import { gql } from "../../../codegen-fixture/graphql-system";
import { userSlice } from "./slices";

// Test case: Operation that imports slice from another file
// Tests runtime import handling and transformation order

export const getUserQuery = gql.default(({ query }, { $var }) =>
  // @ts-expect-error - query.composed is not yet implemented in types
  query.composed(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    // @ts-expect-error - $ parameter type
    ({ $ }) => ({
      user: userSlice.embed({ userId: $.userId }),
    }),
  ),
);
