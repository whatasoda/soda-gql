import { gql } from "../../../codegen-fixture/graphql-system";
import { userModel } from "./slices";

// Test case: Operation that imports model from another file
// Tests runtime import handling and transformation order

export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(() => [userModel.embed()])],
  ),
);
