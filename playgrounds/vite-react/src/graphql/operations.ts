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
  query`query ListEmployees($departmentId: ID, $limit: Int) {
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
  mutation`mutation UpdateTask($taskId: ID!, $title: String, $completed: Boolean) {
    updateTask(id: $taskId, input: { title: $title, completed: $completed }) {
      id
      title
      completed
      priority
    }
  }`(),
);

// ============================================================================
// Phase 1.1: Basic field selection with tagged templates
// ============================================================================

/**
 * Query: Basic scalar fields
 * Demonstrates selecting scalar fields (ID, String, Boolean, Enum) using tagged template syntax
 */
export const getTaskBasicQuery = gql.default(({ query }) =>
  query`query GetTaskBasic($taskId: ID!) {
    task(id: $taskId) {
      id
      title
      completed
      priority
    }
  }`(),
);

/**
 * Query: Nested object fields
 * Demonstrates selecting nested object relationships with their fields
 */
export const getProjectWithTasksQuery = gql.default(({ query }) =>
  query`query GetProjectWithTasks($projectId: ID!) {
    project(id: $projectId) {
      id
      title
      description
      status
      tasks {
        id
        title
        completed
        priority
        dueDate
      }
    }
  }`(),
);

/**
 * Query: Field arguments
 * Demonstrates using field arguments with variables (limit, filters)
 */
export const getEmployeeWithFilteredTasksQuery = gql.default(({ query }) =>
  query`query GetEmployeeWithFilteredTasks($employeeId: ID!, $completed: Boolean, $taskLimit: Int) {
    employee(id: $employeeId) {
      id
      name
      email
      role
      tasks(completed: $completed, limit: $taskLimit) {
        id
        title
        completed
        priority
        dueDate
      }
    }
  }`(),
);

/**
 * Query: Deep nesting (3 levels)
 * Demonstrates selecting deeply nested object relationships
 */
export const getTeamHierarchyQuery = gql.default(({ query }) =>
  query`query GetTeamHierarchy($teamId: ID!) {
    team(id: $teamId) {
      id
      name
      department {
        id
        name
        company {
          id
          name
          industry
        }
      }
      projects {
        id
        title
        status
      }
    }
  }`(),
);

/**
 * Mutation: Create with complex input type
 * Demonstrates mutation with nested input types and field arguments
 */
export const createProjectMutation = gql.default(({ mutation }) =>
  mutation`mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      title
      description
      status
      priority
      createdAt
      team {
        id
        name
      }
    }
  }`(),
);

/**
 * Mutation: Simple update operation
 * Demonstrates mutation with required and optional variables
 */
export const assignTaskMutation = gql.default(({ mutation }) =>
  mutation`mutation AssignTask($taskId: ID!, $employeeId: ID!) {
    assignTask(taskId: $taskId, employeeId: $employeeId) {
      id
      title
      assignee {
        id
        name
        email
      }
    }
  }`(),
);

/**
 * Subscription: Real-time updates
 * Demonstrates subscription operation with nested field selection
 */
export const taskUpdatedSubscription = gql.default(({ subscription }) =>
  subscription`subscription TaskUpdated($taskId: ID!) {
    taskUpdated(taskId: $taskId) {
      id
      title
      completed
      priority
      updatedAt
      assignee {
        id
        name
      }
    }
  }`(),
);

/**
 * Subscription: Project updates with arguments
 * Demonstrates subscription with field arguments and nested selection
 */
export const projectUpdatedSubscription = gql.default(({ subscription }) =>
  subscription`subscription ProjectUpdated($projectId: ID!) {
    projectUpdated(projectId: $projectId) {
      id
      title
      status
      tasks(limit: 5) {
        id
        title
        completed
      }
    }
  }`(),
);

// ============================================================================
// Phase 1.3: Directives in tagged templates
// ============================================================================

/**
 * Query: @skip directive with variable
 * Demonstrates using @skip directive with a boolean variable reference
 */
export const getTaskWithSkipQuery = gql.default(({ query }) =>
  query`query GetTaskWithSkip($taskId: ID!, $skipAssignee: Boolean!) {
    task(id: $taskId) {
      id
      title
      completed
      priority
      assignee @skip(if: $skipAssignee) {
        id
        name
        email
      }
    }
  }`(),
);

/**
 * Query: @include directive with variable
 * Demonstrates using @include directive with a boolean variable reference
 */
export const getProjectWithIncludeQuery = gql.default(({ query }) =>
  query`query GetProjectWithInclude($projectId: ID!, $includeTeam: Boolean!) {
    project(id: $projectId) {
      id
      title
      description
      status
      team @include(if: $includeTeam) {
        id
        name
        department {
          id
          name
        }
      }
    }
  }`(),
);

/**
 * Query: Multiple directives in one operation
 * Demonstrates using both @skip and @include directives in the same operation
 */
export const getEmployeeConditionalQuery = gql.default(({ query }) =>
  query`query GetEmployeeConditional($employeeId: ID!, $includeTasks: Boolean!, $skipComments: Boolean!) {
    employee(id: $employeeId) {
      id
      name
      email
      role
      tasks(limit: 10) @include(if: $includeTasks) {
        id
        title
        completed
        priority
      }
      comments @skip(if: $skipComments) {
        id
        body
        createdAt
      }
    }
  }`(),
);

/**
 * Query: Nested directives
 * Demonstrates using directives on nested fields
 */
export const getTeamNestedDirectivesQuery = gql.default(({ query }) =>
  query`query GetTeamNestedDirectives($teamId: ID!, $includeProjects: Boolean!, $skipInactive: Boolean!) {
    team(id: $teamId) {
      id
      name
      projects @include(if: $includeProjects) {
        id
        title
        status @skip(if: $skipInactive)
        tasks {
          id
          title
        }
      }
    }
  }`(),
);

/**
 * Mutation: Directives in mutation response
 * Demonstrates using directives to conditionally select mutation result fields
 */
export const updateTaskWithDirectivesMutation = gql.default(({ mutation }) =>
  mutation`mutation UpdateTaskWithDirectives(
    $taskId: ID!,
    $title: String,
    $completed: Boolean,
    $includeProject: Boolean!,
    $skipAssignee: Boolean!
  ) {
    updateTask(id: $taskId, input: { title: $title, completed: $completed }) {
      id
      title
      completed
      priority
      project @include(if: $includeProject) {
        id
        title
        status
      }
      assignee @skip(if: $skipAssignee) {
        id
        name
      }
    }
  }`(),
);
