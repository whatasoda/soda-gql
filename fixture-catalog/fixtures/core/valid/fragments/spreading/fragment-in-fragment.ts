import { gql } from "../../../../../graphql-system";

/**
 * Base task fragment
 */
export const taskFragment = gql.default(({ fragment }) => fragment.Task({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }));

/**
 * Employee fragment that spreads the task fragment in its nested field
 */
export const employeeWithTasksFragment = gql.default(({ fragment, $var }) =>
  fragment.Employee({
    variables: { ...$var("completed").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.tasks({ completed: $.completed })(() => ({ ...taskFragment.spread() })),
    }),
  }),
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
