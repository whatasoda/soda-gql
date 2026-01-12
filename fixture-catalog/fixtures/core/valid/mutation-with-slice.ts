import { gql } from "../../../graphql-system";

export const pageAction = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "PageAction",
    variables: { ...$var("projectId").ID("!"), ...$var("title").String("!") },
    fields: ({ f, $ }) => ({
      ...f.createTask({ projectId: $.projectId, input: { title: $.title } })(({ f }) => ({ ...f.id() })),
    }),
  }),
);
