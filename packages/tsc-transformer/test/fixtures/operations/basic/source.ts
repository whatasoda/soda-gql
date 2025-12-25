import { gql } from "../../../codegen-fixture/graphql-system";

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      operationName: "ProfileQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
  ),
);

export const updateProfileMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation(
    {
      operationName: "UpdateProfile",
      variables: [$var("userId").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.userId, name: $.name })(({ f }) => [f.id(), f.name()])],
  ),
);

export const query1 = gql.default(({ query }) =>
  query.operation(
    {
      operationName: "Query1",
    },
    ({ f }) => [f.users({})(({ f }) => [f.id()])],
  ),
);

export const query2 = gql.default(({ query }) =>
  query.operation(
    {
      operationName: "Query2",
    },
    ({ f }) => [f.users({})(({ f }) => [f.name()])],
  ),
);
