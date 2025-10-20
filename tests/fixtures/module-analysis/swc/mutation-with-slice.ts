import { gql } from "@/graphql-system";

const postSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: [$("title").scalar("String:!")],
    },
    ({ f, $ }) => [
      //
      f.createPost({ title: $.title })(({ f }) => [
        //
        f.id(),
      ]),
    ],
    ({ select }) => select(["$.createPost"], (result) => result),
  ),
);

export const pageAction = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "PageAction",
      variables: [$("title").scalar("String:!")],
    },
    ({ $ }) => ({
      post: postSlice.load({ title: $.title }),
    }),
  ),
);
