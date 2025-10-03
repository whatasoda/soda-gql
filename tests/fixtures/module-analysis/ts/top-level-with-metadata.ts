import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({
    id: f.id(),
  }), (value) => value)
);

export const userSlice = gql.default(({ querySlice, scalar }) =>
  querySlice(
    [{ id: scalar("ID", "!") }],
    ({ $, f }) => ({
      users: f.users({ id: $.id }, ({ f: nested }) => ({
        id: nested.id(),
      })),
    }),
    ({ select }) => select("$.users", (result) => result),
  )
);

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      users: userSlice({ id: $.userId }),
    }),
  )
);
