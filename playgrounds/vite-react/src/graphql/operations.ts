import { gql } from "@/graphql-system";
import { employeeFragment } from "./fragments";

/**
 * Query operation to fetch a single employee
 */
export const getEmployeeQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployee",
    variables: { ...$var("employeeId").ID("!"), ...$var("taskLimit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({
        ...employeeFragment.spread({ taskLimit: $.taskLimit }),
      })),
    }),
  }),
);

/**
 * Query operation to fetch multiple employees with optional filters
 */
export const listEmployeesQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ListEmployees",
    variables: {
      ...$var("departmentId").ID("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.employees({ departmentId: $.departmentId, limit: $.limit })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
        ...f.role(),
      })),
    }),
  }),
);

/**
 * Mutation operation to update a task
 */
export const updateTaskMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateTask",
    variables: {
      ...$var("taskId").ID("!"),
      ...$var("title").String("?"),
      ...$var("completed").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.updateTask({ id: $.taskId, input: { title: $.title, completed: $.completed } })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.completed(),
        ...f.priority(),
      })),
    }),
  }),
);
