import { gql } from "../../../../../graphql-system";

/**
 * Base task fragment
 */
export const taskFragment = gql.default(({ fragment }) => fragment("TaskFragment", "Task")`{ id title }`());

/**
 * Employee fragment with nested task fields (uses tagged template since fragment callback builders were removed)
 */
export const employeeWithTasksFragment = gql.default(({ fragment }) =>
  fragment("EmployeeWithTasksFragment", "Employee")`($completed: Boolean) {
    id
    name
    tasks(completed: $completed) {
      id
      title
    }
  }`(),
);

/**
 * Operation that spreads the composed fragment
 */
export const getEmployeeWithTasksQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeWithTasks",
    variables: { ...$var("employeeId").ID("!"), ...$var("completed").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({ ...employeeWithTasksFragment.spread({ completed: $.completed }) })),
    }),
  }),
);
