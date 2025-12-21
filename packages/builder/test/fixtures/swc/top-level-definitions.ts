import { gql } from "../../codegen-fixture/graphql-system";

// Define slice outside operation
const userByIdSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("userId").scalar("ID:!")],
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

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userByIdSlice.embed({ userId: $.userId }),
    }),
  ),
);
