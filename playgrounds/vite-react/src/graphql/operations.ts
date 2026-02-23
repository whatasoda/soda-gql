import { gql } from "@/graphql-system";
import {
  employeeFragment,
  employeeTasksDetailFragment,
  employeeWithStaticMetadataFragment,
  projectTasksFragment,
  projectWithCallbackMetadataFragment,
  taskDetailConditionalFragment,
  taskWithProjectFragment,
} from "./fragments";

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

// ============================================================================
// Phase 1.1: Basic field selection with tagged templates
// ============================================================================

/**
 * Query: Basic scalar fields
 * Demonstrates selecting scalar fields (ID, String, Boolean, Enum) using tagged template syntax
 */
export const getTaskBasicQuery = gql.default(({ query }) =>
  query("GetTaskBasic")`($taskId: ID!) {
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
  query("GetProjectWithTasks")`($projectId: ID!) {
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
  query("GetEmployeeWithFilteredTasks")`($employeeId: ID!, $completed: Boolean, $taskLimit: Int) {
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
  query("GetTeamHierarchy")`($teamId: ID!) {
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
  mutation("CreateProject")`($input: CreateProjectInput!) {
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
  mutation("AssignTask")`($taskId: ID!, $employeeId: ID!) {
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
  subscription("TaskUpdated")`($taskId: ID!) {
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
  subscription("ProjectUpdated")`($projectId: ID!) {
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
  query("GetTaskWithSkip")`($taskId: ID!, $skipAssignee: Boolean!) {
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
  query("GetProjectWithInclude")`($projectId: ID!, $includeTeam: Boolean!) {
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
  query("GetEmployeeConditional")`($employeeId: ID!, $includeTasks: Boolean!, $skipComments: Boolean!) {
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
  query("GetTeamNestedDirectives")`($teamId: ID!, $includeProjects: Boolean!, $skipInactive: Boolean!) {
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
  mutation("UpdateTaskWithDirectives")`(
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

// ============================================================================
// Phase 2.1: Fragment spread with direct interpolation
// ============================================================================
// NOTE: Fragment spreading requires callback builder syntax because tagged templates
// reject all interpolated expressions (${...}).
//
// IMPORTANT: Fragment variables are NOT auto-merged. Parent operations must explicitly
// declare all variables (both their own and those needed by fragments) using $var().
// Fragments define their requirements; operations declare their contract.

/**
 * Phase 2.1: Fragment spread with explicit variable declaration
 *
 * IMPORTANT: Tagged templates reject interpolation! Operations with fragment spreads
 * MUST use callback builder syntax. See fragment-spread-patterns.md for details.
 *
 * This example demonstrates:
 * 1. Spreading a single fragment using ...fragment.spread() syntax
 * 2. EXPLICIT variable declaration - parent operation MUST declare ALL variables
 *    (including those needed by the fragment) using $var()
 * 3. Explicit variable passing - variables are passed via spread({ var: $.var })
 *
 * Variables declared: $employeeId, $completed, $taskLimit
 * Fragment used: employeeTasksDetailFragment (declares the same variables)
 */
export const getEmployeeWithFragmentQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeWithFragment",
    variables: {
      ...$var("employeeId").ID("!"),
      ...$var("completed").Boolean("?"),
      ...$var("taskLimit").Int("?"),
    },
    fields: ({ $ }) => ({
      ...employeeTasksDetailFragment.spread({
        employeeId: $.employeeId,
        completed: $.completed,
        taskLimit: $.taskLimit,
      }),
    }),
  }),
);

/**
 * Phase 2.2: Fragment spread with callback interpolation (multiple fragments)
 *
 * This example demonstrates callback builder pattern for spreading multiple fragments.
 * The fields callback ({ f, $ }) provides the $ context for variable passing.
 *
 * Key points:
 * 1. Multiple fragments can be spread into the same operation
 * 2. Each fragment receives variables through explicit .spread({ ... }) calls
 * 3. Parent operation declares ALL variables (no auto-merge):
 *    - Operation's own: $projectId
 *    - From projectTasksFragment: $limit
 *    - From taskDetailConditionalFragment: $includeProject, $skipAssignee
 *
 * This is "callback interpolation" because the fields are constructed inside
 * the fields: ({ f, $ }) => {...} callback, where $ provides variable context.
 */
export const getProjectWithMultipleFragmentsQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetProjectWithMultipleFragments",
    variables: {
      ...$var("projectId").ID("!"),
      ...$var("limit").Int("?"),
      ...$var("includeProject").Boolean("!"),
      ...$var("skipAssignee").Boolean("!"),
    },
    fields: ({ f, $ }) => ({
      ...f.project({ id: $.projectId })(({ f }) => ({
        ...projectTasksFragment.spread({ limit: $.limit }),
        ...f.tasks()(({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...taskDetailConditionalFragment.spread({
            includeProject: $.includeProject,
            skipAssignee: $.skipAssignee,
          }),
        })),
      })),
    }),
  }),
);

/**
 * Phase 2.2: Mixed operation-level and fragment-level variables
 *
 * This example demonstrates callback builder pattern with mixed variables:
 * - Some variables are used by the operation's own fields ($teamId, $projectStatus)
 * - Some variables are passed to fragments ($limit)
 *
 * All variables must be explicitly declared by the parent operation:
 * - Operation's own: $teamId, $projectStatus
 * - From projectTasksFragment: $limit
 *
 * The fragment is spread within nested field selection:
 * team.projects.{...fragment.spread()}
 */
export const getTeamProjectsWithFragmentQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetTeamProjectsWithFragment",
    variables: {
      ...$var("teamId").ID("!"),
      ...$var("projectStatus").ProjectStatus("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.team({ id: $.teamId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.projects({ status: $.projectStatus, limit: 10 })(() => ({
          ...projectTasksFragment.spread({ limit: $.limit }),
        })),
      })),
    }),
  }),
);

// ============================================================================
// Phase 3.1: Union type selection
// ============================================================================

/**
 * Query: Union type with all members
 * Demonstrates selecting all members of SearchResult union (Employee, Project, Task, Comment)
 * using inline fragments and __typename
 */
export const searchAllQuery = gql.default(({ query }) =>
  query("SearchAll")`($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      __typename
      ... on Employee {
        id
        name
        email
        role
      }
      ... on Project {
        id
        title
        description
        status
      }
      ... on Task {
        id
        title
        completed
        priority
      }
      ... on Comment {
        id
        body
        createdAt
      }
    }
  }`(),
);

/**
 * Query: Union type with partial member selection
 * Demonstrates selecting only some union members (Employee and Project from SearchResult)
 * to verify that output type includes only selected members
 */
export const searchPartialQuery = gql.default(({ query }) =>
  query("SearchPartial")`($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      __typename
      ... on Employee {
        id
        name
        email
        role
        department {
          id
          name
        }
      }
      ... on Project {
        id
        title
        description
        status
        team {
          id
          name
        }
      }
    }
  }`(),
);

/**
 * Query: ActivityItem union type
 * Demonstrates ActivityItem union (Task, Comment, Project) with nested field selection
 * and __typename discrimination
 */
export const activityFeedQuery = gql.default(({ query }) =>
  query("ActivityFeed")`($userId: ID!, $since: DateTime, $limit: Int) {
    activityFeed(userId: $userId, since: $since, limit: $limit) {
      __typename
      ... on Task {
        id
        title
        completed
        priority
        dueDate
        assignee {
          id
          name
        }
        project {
          id
          title
        }
      }
      ... on Comment {
        id
        body
        createdAt
        author {
          id
          name
        }
        task {
          id
          title
        }
      }
      ... on Project {
        id
        title
        description
        status
        priority
        tasks(limit: 5) {
          id
          title
          completed
        }
      }
    }
  }`(),
);

// ============================================================================
// Phase 2.3: Nested fragment composition
// ============================================================================

/**
 * Phase 2.3: 3-level nested fragment composition
 *
 * This example demonstrates 3-level fragment composition using tagged template interpolation:
 * - Fragment C (taskBasicFieldsFragment): innermost - basic task fields (id, title, completed)
 * - Fragment B (taskExtendedFieldsFragment): spreads C via ...${C} + adds priority, dueDate
 * - Fragment A (taskWithProjectFragment): spreads B via ...${B} + adds assignee, project
 * - Operation: spreads A using callback builder syntax
 *
 * Variable propagation through all 3 levels:
 * - Fragment C: no variables
 * - Fragment B: $includePriority (optional Boolean)
 * - Fragment A: $includePriority (passed to B), $includeAssignee (own variable)
 * - Operation: declares all variables explicitly ($taskId, $includePriority, $includeAssignee)
 *
 * Key observations:
 * - Fragment-to-fragment spreading uses tagged template interpolation: ...${fragment}
 * - Operation-to-fragment spreading uses callback builder: ...fragment.spread({...})
 * - Parent operation must explicitly declare ALL variables from the entire fragment hierarchy
 */
export const getTaskWithNestedFragmentsQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetTaskWithNestedFragments",
    variables: {
      ...$var("taskId").ID("!"),
      ...$var("includePriority").Boolean("?"),
      ...$var("includeAssignee").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.task({ id: $.taskId })(() => ({
        ...taskWithProjectFragment.spread({
          includePriority: $.includePriority,
          includeAssignee: $.includeAssignee,
        }),
      })),
    }),
  }),
);

// ============================================================================
// Phase 3.2: Metadata attachment
// ============================================================================

/**
 * Query with static metadata
 * Demonstrates attaching static metadata to a tagged template query
 */
export const getEmployeeWithStaticMetadataQuery = gql.default(({ query }) =>
  query("GetEmployeeWithStaticMetadata")`($employeeId: ID!) {
    employee(id: $employeeId) {
      id
      name
      email
      role
    }
  }`({
    metadata: {
      operationType: "read",
      cacheTTL: 600,
      requiresAuth: true,
      tags: ["employee", "query"],
    },
  }),
);

/**
 * Query with callback metadata
 * Demonstrates metadata callback that receives operation variable context
 */
export const getProjectWithCallbackMetadataQuery = gql.default(({ query }) =>
  query("GetProjectWithCallbackMetadata")`($projectId: ID!, $includeTeam: Boolean!) {
    project(id: $projectId) {
      id
      title
      description
      status
      team @include(if: $includeTeam) {
        id
        name
      }
    }
  }`({
    metadata: ({ $ }: { $: { projectId: string; includeTeam: boolean } }) => ({
      operationType: "read",
      entityType: "project",
      entityId: $.projectId,
      includesRelations: $.includeTeam,
      cacheKey: `project:${$.projectId}:team=${$.includeTeam}`,
      headers: {
        "X-Entity-Type": "Project",
        "X-Entity-Id": $.projectId,
      },
    }),
  }),
);

/**
 * Operation with metadata propagation from fragment
 * Demonstrates how fragment metadata propagates to the parent operation
 * through fragmentMetadata in the operation's metadata callback
 */
export const getEmployeeWithFragmentMetadataQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeWithFragmentMetadata",
    variables: { ...$var("employeeId").ID("!") },
    metadata: ({ $, fragmentMetadata }) => ({
      operationType: "read",
      entityType: "employee",
      entityId: $.employeeId,
      hasFragmentMetadata: fragmentMetadata !== undefined && fragmentMetadata.length > 0,
      fragmentCount: fragmentMetadata?.length ?? 0,
      // Access first fragment's metadata if available
      fragmentTags: (fragmentMetadata?.[0] as { tags?: string[] })?.tags ?? [],
    }),
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({
        ...employeeWithStaticMetadataFragment.spread(),
      })),
    }),
  }),
);

/**
 * Operation spreading fragment with callback metadata
 * Demonstrates operation accessing fragment metadata from a fragment with callback metadata
 */
export const getProjectWithFragmentCallbackMetadataQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetProjectWithFragmentCallbackMetadata",
    variables: {
      ...$var("projectId").ID("!"),
      ...$var("priority").Int("?"),
    },
    metadata: ({ $, fragmentMetadata }) => ({
      operationType: "read",
      entityType: "project",
      entityId: $.projectId,
      priority: $.priority,
      // Fragment metadata propagation
      fragmentMetadataCount: fragmentMetadata?.length ?? 0,
      hasFragmentCacheKey: (fragmentMetadata?.[0] as { cacheKey?: string })?.cacheKey !== undefined,
      fragmentCacheKey: (fragmentMetadata?.[0] as { cacheKey?: string })?.cacheKey,
    }),
    fields: ({ f, $ }) => ({
      ...f.project({ id: $.projectId })(() => ({
        ...projectWithCallbackMetadataFragment.spread({
          projectId: $.projectId,
          priority: $.priority,
        }),
      })),
    }),
  }),
);
