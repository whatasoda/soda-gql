import { gql } from "@/graphql-system";

const createPostSlice = gql.default(({ mutation }, { $ }) =>
  mutation.slice(
    {
      variables: [$("title").scalar("String:!"), $("body").scalar("String:?")],
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

export const createPostMutation = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "CreatePost",
      variables: [$("title").scalar("String:!"), $("body").scalar("String:?")],
    },
    ({ $ }) => ({
      post: createPostSlice.embed({ title: $.title, body: $.body }),
    }),
  ),
);
