import { gql } from "@/graphql-system";

// Define slice outside operation
const userByIdSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
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

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userByIdSlice.load({ userId: $.userId }),
    }),
  ),
);
