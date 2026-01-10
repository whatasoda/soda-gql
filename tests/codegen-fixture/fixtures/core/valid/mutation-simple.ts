import { gql } from "../../codegen-fixture/graphql-system";

export const createPostMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "CreatePost",
    variables: { ...$var("title").String("!"), ...$var("body").String("?") },
    fields: ({ f, $ }) => ({ ...f.createPost({ title: $.title, body: $.body })(({ f }) => ({ ...f.id(), ...f.title() })) }),
  }),
);
