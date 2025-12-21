import { gql } from "../../graphql-system";

const createPostSlice = gql.default(({ mutation }, { $var }) =>
  mutation.slice(
    {
      variables: [$var("title").scalar("String:!"), $var("body").scalar("String:?")],
    },
    ({ f, $ }) => [
      //
      f.createPost({ title: $.title, body: $.body })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    ({ select }) => select(["$.createPost"], (result) => result.safeUnwrap(([post]) => post)),
  ),
);

export const createPostMutation = gql.default(({ mutation }, { $var }) =>
  mutation.composed(
    {
      operationName: "CreatePost",
      variables: [$var("title").scalar("String:!"), $var("body").scalar("String:?")],
    },
    ({ $ }) => ({
      post: createPostSlice.embed({ title: $.title, body: $.body }),
    }),
  ),
);
