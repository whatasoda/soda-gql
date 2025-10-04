import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({
      ...f.id(),
    }),
    (value) => value,
  ),
);

export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    {
      variables: { ...$("id").scalar("ID:!") },
    },
    ({ $, _: f }) => ({
      ...f.users({ id: [$.id] }, ({ f: nested }) => ({
        ...nested.id(),
      })),
    }),
    ({ select }) => select(["$.users"], (result) => result),
  ),
);

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: { ...$("userId").scalar("ID:!") },
    },
    ({ $ }) => ({
      users: userSlice.build({ id: $.userId }),
    }),
  ),
);
