import { gql } from "@/graphql-system";

/**
 * Employee fragment with nested tasks
 * Demonstrates fragment definition with variables and nested field selections
 */
export const employeeFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeFragment($taskLimit: Int) on Employee {
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
  fragment`fragment TaskFragment on Task { id title completed priority dueDate }`(),
);
