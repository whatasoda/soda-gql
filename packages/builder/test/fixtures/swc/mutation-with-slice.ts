import { gql } from "../../graphql-system";

const postSlice = gql.default(({ mutation }, { $var }) =>
  mutation.slice(
    {
      variables: [$var("title").scalar("String:!")],
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

export const pageAction = gql.default(({ mutation }, { $var }) =>
  mutation.composed(
    {
      operationName: "PageAction",
      variables: [$var("title").scalar("String:!")],
    },
    ({ $ }) => ({
      post: postSlice.embed({ title: $.title }),
    }),
  ),
);
