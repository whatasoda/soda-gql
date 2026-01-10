import { gql } from "../../graphql-system";

export const pageAction = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "PageAction",
    variables: { ...$var("title").String("!") },
    fields: ({ f, $ }) => ({ ...f.createPost({ title: $.title })(({ f }) => ({ ...f.id() })) }),
  }),
);
