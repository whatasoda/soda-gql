import { gql } from "../../../graphql-system";

export const createTaskMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateTask",
    variables: { ...$var("projectId").ID("!"), ...$var("title").String("!") },
    fields: ({ f, $ }) => ({
      ...f.createTask({ projectId: $.projectId, input: { title: $.title } })(({ f }) => ({ ...f.id(), ...f.title() })),
    }),
  }),
);
