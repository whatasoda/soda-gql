import { gql } from "../../../../../graphql-system";

/**
 * Base task fragment
 */
export const taskFragment = gql.default(({ fragment }) => fragment`fragment TaskFragment on Task { id title }`());

/**
 * Employee fragment that spreads the task fragment in its nested field
 */
export const employeeWithTasksFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeWithTasksFragment($completed: Boolean) on Employee {
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
