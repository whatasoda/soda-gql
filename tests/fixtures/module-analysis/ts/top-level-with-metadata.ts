import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
    ],
    (value) => value,
  ),
);

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.users({ id: [$.id] })(({ f: nested }) => [
        //
        nested.id(),
      ]),
    ],
    ({ select }) => select(["$.users"], (result) => result),
  ),
);

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      users: userSlice.embed({ id: $.userId }),
    }),
  ),
);
