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

// ============================================================================
// Phase 1.1: Additional basic fragments demonstrating field selection patterns
// ============================================================================

/**
 * Project fragment: Scalar and nested fields
 * Demonstrates selecting scalar fields alongside nested object fields
 */
export const projectBasicFragment = gql.default(({ fragment }) =>
  fragment`fragment ProjectBasic on Project {
    id
    title
    description
    status
    priority
    createdAt
    updatedAt
  }`(),
);

/**
 * Comment fragment: Multi-level nesting
 * Demonstrates selecting nested author and task fields
 */
export const commentFragment = gql.default(({ fragment }) =>
  fragment`fragment CommentDetail on Comment {
    id
    body
    createdAt
    author {
      id
      name
      email
    }
    task {
      id
      title
    }
  }`(),
);

/**
 * Department fragment: Interface field selection
 * Demonstrates selecting fields from interfaces (Node, Timestamped)
 */
export const departmentFragment = gql.default(({ fragment }) =>
  fragment`fragment DepartmentInfo on Department {
    id
    name
    budget
    createdAt
    updatedAt
    manager {
      id
      name
      role
    }
  }`(),
);

/**
 * Company fragment: Deep nested lists
 * Demonstrates selecting nested lists of objects with arguments
 */
export const companyDetailFragment = gql.default(({ fragment }) =>
  fragment`fragment CompanyDetail on Company {
    id
    name
    industry
    departments {
      id
      name
      teams {
        id
        name
      }
    }
    employees(limit: 10) {
      id
      name
      role
    }
  }`(),
);
