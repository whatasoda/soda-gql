import { gql } from "../../../codegen-fixture/graphql-system";

export const profileQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ProfileQuery",
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name()])],
  }),
);

export const updateProfileMutation = gql.default(({ mutation }, { $var }) =>
  mutation.operation({
    name: "UpdateProfile",
    variables: [$var("userId").scalar("ID:!"), $var("name").scalar("String:!")],
    fields: ({ f, $ }) => [f.updateUser({ id: $.userId, name: $.name })(({ f }) => [f.id(), f.name()])],
  }),
);

export const query1 = gql.default(({ query }) =>
  query.operation({
    name: "Query1",
    fields: ({ f }) => [f.users({})(({ f }) => [f.id()])],
  }),
);

export const query2 = gql.default(({ query }) =>
  query.operation({
    name: "Query2",
    fields: ({ f }) => [f.users({})(({ f }) => [f.name()])],
  }),
);
