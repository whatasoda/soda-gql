import { gql } from "@/graphql-system";

// Define slices
const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: [$("id").scalar("ID:!")],
    },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [$("id").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);

// Define operations
export const userQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "UserQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.load({ id: $.userId }),
    }),
  ),
);

export const updateUserMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateUser",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.load({ id: $.userId, name: $.name }),
    }),
  ),
);
