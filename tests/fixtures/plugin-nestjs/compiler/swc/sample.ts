import { gql } from "@/graphql-system";

// Define slices
const userSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

const updateUserSlice = gql.default(({ mutation }, { $ }) =>
  mutation.slice(
    {
      variables: [$("id").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);

// Define operations
export const userQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "UserQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);

export const updateUserMutation = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "UpdateUser",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.embed({ id: $.userId, name: $.name }),
    }),
  ),
);
