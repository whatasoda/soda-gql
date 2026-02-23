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
export const listEmployeesQuery = gql.default(({ query }) =>
  query("ListEmployees")`($departmentId: ID, $limit: Int) {
    employees(departmentId: $departmentId, limit: $limit) {
      id
      name
      email
      role
    }
  }`(),
);

/**
 * Mutation operation to update a task
 */
export const updateTaskMutation = gql.default(({ mutation }) =>
  mutation("UpdateTask")`($taskId: ID!, $title: String, $completed: Boolean) {
    updateTask(id: $taskId, input: { title: $title, completed: $completed }) {
      id
      title
      completed
      priority
    }
  }`(),
);
