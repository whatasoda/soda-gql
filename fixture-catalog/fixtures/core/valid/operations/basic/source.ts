import { gql } from "../../../../../graphql-system";

export const profileQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfileQuery",
    variables: { ...$var("employeeId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.employeeId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);

export const updateTaskMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateTaskMutation",
    variables: { ...$var("taskId").ID("!"), ...$var("title").String("?") },
    fields: ({ f, $ }) => ({
      ...f.updateTask({ id: $.taskId, input: { title: $.title } })(({ f }) => ({ ...f.id(), ...f.title() })),
    }),
  }),
);

export const query1 = gql.default(({ query }) =>
  query.operation({
    name: "Query1",
    fields: ({ f }) => ({ ...f.employees({})(({ f }) => ({ ...f.id() })) }),
  }),
);

export const query2 = gql.default(({ query }) =>
  query.operation({
    name: "Query2",
    fields: ({ f }) => ({ ...f.employees({})(({ f }) => ({ ...f.name() })) }),
  }),
);
