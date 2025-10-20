import { gql } from "@/graphql-system";

const createPostSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
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

export const createPostMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "CreatePost",
      variables: [$("title").scalar("String:!"), $("body").scalar("String:?")],
    },
    ({ $ }) => ({
      post: createPostSlice.load({ title: $.title, body: $.body }),
    }),
  ),
);
