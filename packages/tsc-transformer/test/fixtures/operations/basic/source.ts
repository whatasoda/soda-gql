import { gql } from "../../../codegen-fixture/graphql-system";

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfileQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    () => ({}),
  ),
);

export const updateProfileMutation = gql.default(({ mutation }, { $var }) =>
  mutation.composed(
    {
      operationName: "UpdateProfile",
      variables: [$var("userId").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    () => ({}),
  ),
);

export const query1 = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "Query1",
    },
    () => ({}),
  ),
);

export const query2 = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "Query2",
    },
    () => ({}),
  ),
);
