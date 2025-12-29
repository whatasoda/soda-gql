import { gql } from "../codegen-fixture/graphql-system";

// Simple model for testing
export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id(), f.email()] }));

// Simple operation for testing
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "GetUser",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.email()])],
  }),
);
