import { gql } from "@/graphql-system";

const postSlice = gql.default(({ mutation }, { $ }) =>
  mutation.slice(
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

export const pageAction = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "PageAction",
      variables: [$("title").scalar("String:!")],
    },
    ({ $ }) => ({
      post: postSlice.embed({ title: $.title }),
    }),
  ),
);
