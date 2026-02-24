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

// ============================================================================
// Phase 1.1: Additional basic fragments demonstrating field selection patterns
// ============================================================================

/**
 * Project fragment: Scalar and nested fields
 * Demonstrates selecting scalar fields alongside nested object fields
 */
export const projectBasicFragment = gql.default(({ fragment }) =>
  fragment("ProjectBasic", "Project")`{
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
  fragment("CommentDetail", "Comment")`{
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
  fragment("DepartmentInfo", "Department")`{
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
  fragment("CompanyDetail", "Company")`{
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
  fragment("EmployeeById", "Query")`($id: ID!) {
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
  fragment("ProjectTasks", "Project")`($limit: Int) {
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
  fragment("EmployeesByRole", "Company")`($role: EmployeeRole) {
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
  fragment("FilteredProjects", "Query")`($filter: ProjectFilterInput) {
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
  fragment("EmployeeTasksDetail", "Query")`($employeeId: ID!, $completed: Boolean, $taskLimit: Int) {
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
  fragment("TeamProjectTasks", "Team")`($projectStatus: ProjectStatus, $taskLimit: Int) {
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
  fragment("EmployeeConditional", "Employee")`($skipEmail: Boolean!) {
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
  fragment("ProjectConditional", "Project")`($includeTeam: Boolean!) {
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
  fragment("TaskDetailConditional", "Task")`($includeProject: Boolean!, $skipAssignee: Boolean!) {
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
  fragment("CompanyDetailConditional", "Company")`($includeDepartments: Boolean!, $skipEmployees: Boolean!) {
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

// ============================================================================
// Phase 2.3: Nested fragment composition (3-level fragment hierarchy)
// ============================================================================
// Fragment composition demonstrates multi-level fragment spreading where:
// - Fragment C (innermost): Basic task fields
// - Fragment B (middle): Spreads Fragment C and adds more task fields
// - Fragment A (outermost): Spreads Fragment B and adds project fields
// - Operation: Spreads Fragment A

/**
 * Fragment C (innermost level): Basic task fields
 * Demonstrates the innermost fragment in a 3-level composition
 * Variables: none
 */
export const taskBasicFieldsFragment = gql.default(({ fragment }) =>
  fragment("TaskBasicFields", "Task")`{
    id
    title
    completed
  }`(),
);

/**
 * Fragment B (middle level): Extended task fields, spreads Fragment C
 * Demonstrates middle-level fragment composition using direct interpolation
 * Variables: $includePriority (optional boolean for @include directive)
 */
export const taskExtendedFieldsFragment = gql.default(({ fragment }) =>
  fragment("TaskExtendedFields", "Task")`($includePriority: Boolean) {
    ...${taskBasicFieldsFragment}
    priority @include(if: $includePriority)
    dueDate
  }`(),
);

/**
 * Fragment A (outermost level): Task with project context, spreads Fragment B
 * Demonstrates outermost fragment composition using direct interpolation
 * Variables: $includePriority (passed to Fragment B), $includeAssignee (own variable)
 */
export const taskWithProjectFragment = gql.default(({ fragment }) =>
  fragment("TaskWithProject", "Task")`($includePriority: Boolean, $includeAssignee: Boolean) {
    ...${taskExtendedFieldsFragment}
    assignee @include(if: $includeAssignee) {
      id
      name
      email
    }
    project {
      id
      title
      status
    }
  }`(),
);

// ============================================================================
// Phase 4.1: Coverage gap — additional scalar types
// ============================================================================

/**
 * Fragment: Full task detail with Float and all timestamp fields
 * Exercises: Float (estimatedHours), DateTime (dueDate, createdAt, updatedAt)
 */
export const taskFullDetailFragment = gql.default(({ fragment }) =>
  fragment("TaskFullDetail", "Task")`{
    id
    title
    completed
    priority
    dueDate
    estimatedHours
    createdAt
    updatedAt
  }`(),
);

// ============================================================================
// Phase 4.2: Coverage gap — recursive relationships
// ============================================================================

/**
 * Fragment: Comment thread with recursive parent/replies
 * Exercises: Comment.parent, Comment.replies(limit)
 */
export const commentThreadFragment = gql.default(({ fragment }) =>
  fragment("CommentThread", "Comment")`($repliesLimit: Int) {
    id
    body
    createdAt
    author {
      id
      name
    }
    parent {
      id
      body
    }
    replies(limit: $repliesLimit) {
      id
      body
      createdAt
      author {
        id
        name
      }
    }
  }`(),
);

/**
 * Fragment: Employee hierarchy with recursive manager and reports
 * Exercises: Employee.manager, Employee.reports(limit), Employee.salary (BigInt)
 */
export const employeeHierarchyFragment = gql.default(({ fragment }) =>
  fragment("EmployeeHierarchy", "Employee")`($reportsLimit: Int) {
    id
    name
    email
    role
    salary
    manager {
      id
      name
      role
    }
    reports(limit: $reportsLimit) {
      id
      name
      role
    }
  }`(),
);

// ============================================================================
// Phase 4.3: Coverage gap — unused relation fields
// ============================================================================

/**
 * Fragment: Team members and lead
 * Exercises: Team.members(limit), Team.lead
 */
export const teamMembersFragment = gql.default(({ fragment }) =>
  fragment("TeamMembers", "Team")`($membersLimit: Int) {
    id
    name
    lead {
      id
      name
      role
    }
    members(limit: $membersLimit) {
      id
      name
      email
      role
    }
  }`(),
);

// ============================================================================
// Phase 4.4: Coverage gap — default variable values in fragments
// ============================================================================

/**
 * Fragment: Project tasks with default limit
 * Exercises: Default variable values ($taskLimit: Int = 5)
 */
export const projectWithDefaultLimitFragment = gql.default(({ fragment }) =>
  fragment("ProjectWithDefaultLimit", "Project")`($taskLimit: Int = 5) {
    id
    title
    status
    tasks(limit: $taskLimit) {
      id
      title
      completed
    }
  }`(),
);

// ============================================================================
// Phase 3.2: Metadata attachment
// ============================================================================

/**
 * Fragment with static metadata
 * Demonstrates attaching static metadata to a fragment using tagged template syntax
 */
export const employeeWithStaticMetadataFragment = gql.default(({ fragment }) =>
  fragment("EmployeeWithStaticMetadata", "Employee")`{
    id
    name
    email
    role
  }`({
    metadata: {
      cacheTTL: 300,
      requiresAuth: true,
      tags: ["employee", "user-info"],
    },
  }),
);

/**
 * Fragment with callback metadata
 * Demonstrates metadata callback that receives variable context
 */
export const projectWithCallbackMetadataFragment = gql.default(({ fragment }) =>
  fragment("ProjectWithCallbackMetadata", "Project")`($projectId: ID!, $priority: Int) {
    id
    title
    description
    status
    priority
  }`({
    metadata: ({ $ }: { $: { projectId: string; priority?: number | null } }) => ({
      cacheKey: `project:${$.projectId}`,
      isPriorityQuery: $.priority !== undefined,
      headers: {
        "X-Project-Id": $.projectId,
      },
    }),
  }),
);

/**
 * Fragment with metadata demonstrating variable access
 * Shows metadata callback accessing fragment variables
 */
export const taskWithMetadataFragment = gql.default(({ fragment }) =>
  fragment("TaskWithMetadata", "Task")`($taskId: ID!, $includeComments: Boolean) {
    id
    title
    completed
    priority
    dueDate
  }`({
    metadata: ({ $ }: { $: { taskId: string; includeComments?: boolean | null } }) => ({
      entityType: "task",
      entityId: $.taskId,
      includesRelations: $.includeComments === true,
      cacheStrategy: $.includeComments ? "no-cache" : "cache-first",
    }),
  }),
);
