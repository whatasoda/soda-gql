import { gql } from "../codegen-fixture/graphql-system";

// Simple model for testing
export const userModel = gql.default(({ model }) =>
  model.User({}, ({ f }) => [f.id(), f.email()]),
);

// Simple operation for testing
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      operationName: "GetUser",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.email()])],
  ),
);
