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

// ============================================================================
// Phase 1.2: Fragment variables and arguments
// ============================================================================

/**
 * Fragment with required variable
 * Demonstrates fragment with required ID variable using Fragment Arguments RFC syntax
 */
export const employeeByIdFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeById($id: ID!) on Query {
    employee(id: $id) {
      id
      name
      email
      role
    }
  }`(),
);

/**
 * Fragment with optional variable
 * Demonstrates fragment with optional Int variable for limit parameter
 */
export const projectTasksFragment = gql.default(({ fragment }) =>
  fragment`fragment ProjectTasks($limit: Int) on Project {
    id
    title
    tasks(limit: $limit) {
      id
      title
      completed
    }
  }`(),
);

/**
 * Fragment with enum variable
 * Demonstrates fragment with enum variable for filtering by employee role
 */
export const employeesByRoleFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeesByRole($role: EmployeeRole) on Company {
    id
    name
    employees(role: $role, limit: 20) {
      id
      name
      email
      role
    }
  }`(),
);

/**
 * Fragment with complex input variable
 * Demonstrates fragment with complex input type variable for filtering
 */
export const filteredProjectsFragment = gql.default(({ fragment }) =>
  fragment`fragment FilteredProjects($filter: ProjectFilterInput) on Query {
    projects(filter: $filter, limit: 50) {
      id
      title
      status
      priority
      team {
        id
        name
      }
    }
  }`(),
);

/**
 * Fragment with multiple variables
 * Demonstrates fragment with multiple variables of different types
 */
export const employeeTasksDetailFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeTasksDetail($employeeId: ID!, $completed: Boolean, $taskLimit: Int) on Query {
    employee(id: $employeeId) {
      id
      name
      role
      tasks(completed: $completed, limit: $taskLimit) {
        id
        title
        completed
        priority
        dueDate
        project {
          id
          title
          status
        }
      }
    }
  }`(),
);

/**
 * Fragment with variable used in nested field arguments
 * Demonstrates variable usage deep in the fragment body
 */
export const teamProjectTasksFragment = gql.default(({ fragment }) =>
  fragment`fragment TeamProjectTasks($projectStatus: ProjectStatus, $taskLimit: Int) on Team {
    id
    name
    projects(status: $projectStatus, limit: 10) {
      id
      title
      status
      tasks(limit: $taskLimit) {
        id
        title
        completed
        priority
      }
    }
  }`(),
);

// ============================================================================
// Phase 1.3: Directives in tagged templates
// ============================================================================

/**
 * Fragment with @skip directive
 * Demonstrates using @skip directive on fragment fields with a variable
 */
export const employeeConditionalFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeConditional($skipEmail: Boolean!) on Employee {
    id
    name
    email @skip(if: $skipEmail)
    role
    tasks(limit: 5) {
      id
      title
    }
  }`(),
);

/**
 * Fragment with @include directive
 * Demonstrates using @include directive on fragment fields with a variable
 */
export const projectConditionalFragment = gql.default(({ fragment }) =>
  fragment`fragment ProjectConditional($includeTeam: Boolean!) on Project {
    id
    title
    description
    status
    team @include(if: $includeTeam) {
      id
      name
    }
  }`(),
);

/**
 * Fragment with both @skip and @include directives
 * Demonstrates using multiple directives in a single fragment
 */
export const taskDetailConditionalFragment = gql.default(({ fragment }) =>
  fragment`fragment TaskDetailConditional($includeProject: Boolean!, $skipAssignee: Boolean!) on Task {
    id
    title
    completed
    priority
    dueDate
    project @include(if: $includeProject) {
      id
      title
      status
    }
    assignee @skip(if: $skipAssignee) {
      id
      name
      email
    }
  }`(),
);

/**
 * Fragment with nested directives
 * Demonstrates using directives on nested fields within a fragment
 */
export const companyDetailConditionalFragment = gql.default(({ fragment }) =>
  fragment`fragment CompanyDetailConditional($includeDepartments: Boolean!, $skipEmployees: Boolean!) on Company {
    id
    name
    industry
    departments @include(if: $includeDepartments) {
      id
      name
      teams {
        id
        name
      }
    }
    employees(limit: 10) @skip(if: $skipEmployees) {
      id
      name
      role
    }
  }`(),
);
