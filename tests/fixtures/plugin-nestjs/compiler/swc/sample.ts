import { gql } from "@/graphql-system";

// Define slices
const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

const updateUserSlice = gql.default(({ mutation }, { $var }) =>
  mutation.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);

// Define operations
export const userQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "UserQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);

export const updateUserMutation = gql.default(({ mutation }, { $var }) =>
  mutation.composed(
    {
      operationName: "UpdateUser",
      variables: [$var("userId").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.embed({ id: $.userId, name: $.name }),
    }),
  ),
);
