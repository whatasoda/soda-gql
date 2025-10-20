import { gql } from "@/graphql-system";

// Define slice outside operation
const userByIdSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    {
      variables: [$("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.userId })(({ f }) => [
        //
        f.id(),
      ]),
    ],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userByIdSlice.embed({ userId: $.userId }),
    }),
  ),
);
