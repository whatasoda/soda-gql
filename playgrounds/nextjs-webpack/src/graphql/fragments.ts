import { gql } from "@/graphql-system";

/**
 * Employee fragment with nested tasks
 * Demonstrates fragment definition with variables and nested field selections
 */
export const employeeFragment = gql.default(({ fragment }) =>
  fragment("EmployeeFragment", "Employee")`($taskLimit: Int) {
    id
    name
    email
    role
    tasks(limit: $taskLimit) {
      id
      title
      completed
      priority
    }
  }`(),
);

/**
 * Simple task fragment without variables
 */
export const taskFragment = gql.default(({ fragment }) =>
  fragment("TaskFragment", "Task")`{ id title completed priority dueDate }`(),
);
