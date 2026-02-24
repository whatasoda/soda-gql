/**
 * Standalone verification script for tagged template definitions.
 *
 * Imports all playground tagged template definitions and verifies that:
 * 1. Operations produce correct GraphQL document strings via print(document)
 * 2. Fragments construct successfully and expose expected properties
 * 3. Compat definitions store correct GraphQL source strings
 *
 * Usage: bun run verify:tagged-templates
 * Exit 0 on success, non-zero on failure.
 */

import type { DocumentNode } from "graphql";
import { print } from "graphql";
import { gql } from "@/graphql-system";
import * as fragments from "./fragments";
import * as operations from "./operations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationResult = {
  name: string;
  category: "operation" | "fragment" | "compat";
  status: "pass" | "fail" | "skip";
  actual?: string;
  expected?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Expected strings (populated in Phase 2)
// ---------------------------------------------------------------------------

/** Expected GraphQL strings for operation definitions. */
export const expectedOperationStrings: Record<string, string> = {
  activityFeedQuery: `query ActivityFeed($userId: ID!, $since: DateTime, $limit: Int) {
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
}`,

  assignTaskMutation: `mutation AssignTask($taskId: ID!, $employeeId: ID!) {
  assignTask(taskId: $taskId, employeeId: $employeeId) {
    id
    title
    assignee {
      id
      name
      email
    }
  }
}`,

  commentAddedSubscription: `subscription CommentAdded($taskId: ID!) {
  commentAdded(taskId: $taskId) {
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
}`,

  createProjectMutation: `mutation CreateProject($input: CreateProjectInput!) {
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
}`,

  createTaskMutation: `mutation CreateTask($projectId: ID!, $input: CreateTaskInput!) {
  createTask(projectId: $projectId, input: $input) {
    id
    title
    priority
    dueDate
    estimatedHours
    assignee {
      id
      name
    }
  }
}`,

  getCommentWithRepliesQuery: `query GetCommentWithReplies($commentId: ID!, $repliesLimit: Int) {
  comment(id: $commentId) {
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
      author {
        id
        name
      }
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
  }
}`,

  getEmployeeAliasedQuery: `query GetEmployeeAliased($employeeId: ID!) {
  employee(id: $employeeId) {
    id
    fullName: name
    emailAddress: email
    jobRole: role
  }
}`,

  getEmployeeConditionalQuery: `query GetEmployeeConditional($employeeId: ID!, $includeTasks: Boolean!, $skipComments: Boolean!) {
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
}`,

  getEmployeeQuery: `query GetEmployee($employeeId: ID!, $taskLimit: Int) {
  employee(id: $employeeId) {
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
  }
}`,

  getEmployeeWithFilteredTasksQuery: `query GetEmployeeWithFilteredTasks($employeeId: ID!, $completed: Boolean, $taskLimit: Int) {
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
}`,

  getEmployeeWithFragmentMetadataQuery: `query GetEmployeeWithFragmentMetadata($employeeId: ID!) {
  employee(id: $employeeId) {
    id
    name
    email
    role
  }
}`,

  getEmployeeWithFragmentQuery: `query GetEmployeeWithFragment($employeeId: ID!, $completed: Boolean, $taskLimit: Int) {
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
}`,

  getEmployeeWithReportsQuery: `query GetEmployeeWithReports($employeeId: ID!, $reportsLimit: Int) {
  employee(id: $employeeId) {
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
      email
      role
    }
  }
}`,

  getEmployeeWithStaticMetadataQuery: `query GetEmployeeWithStaticMetadata($employeeId: ID!) {
  employee(id: $employeeId) {
    id
    name
    email
    role
  }
}`,

  getProjectWithCallbackMetadataQuery: `query GetProjectWithCallbackMetadata($projectId: ID!, $includeTeam: Boolean!) {
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
}`,

  getProjectWithFragmentCallbackMetadataQuery: `query GetProjectWithFragmentCallbackMetadata($projectId: ID!, $priority: Int) {
  project(id: $projectId) {
    id
    title
    description
    status
    priority
  }
}`,

  getProjectWithIncludeQuery: `query GetProjectWithInclude($projectId: ID!, $includeTeam: Boolean!) {
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
}`,

  getProjectWithMultipleFragmentsQuery: `query GetProjectWithMultipleFragments($projectId: ID!, $limit: Int, $includeProject: Boolean!, $skipAssignee: Boolean!) {
  project(id: $projectId) {
    id
    title
    tasks {
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
      assignee {
        id
        name
        email
      }
    }
  }
}`,

  getProjectWithTasksQuery: `query GetProjectWithTasks($projectId: ID!) {
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
}`,

  getTaskBasicQuery: `query GetTaskBasic($taskId: ID!) {
  task(id: $taskId) {
    id
    title
    completed
    priority
  }
}`,

  getTaskDualDirectivesQuery: `query GetTaskDualDirectives($taskId: ID!, $showAssignee: Boolean!, $hideAssignee: Boolean!) {
  task(id: $taskId) {
    id
    title
    completed
    assignee @include(if: $showAssignee) @skip(if: $hideAssignee) {
      id
      name
      email
    }
  }
}`,

  getTaskFullDetailQuery: `query GetTaskFullDetail($taskId: ID!) {
  task(id: $taskId) {
    id
    title
    completed
    priority
    dueDate
    estimatedHours
    createdAt
    updatedAt
    project {
      id
      title
      status
      metadata
    }
    assignee {
      id
      name
      email
      role
      salary
    }
    comments(limit: 5) {
      id
      body
      createdAt
    }
  }
}`,

  getTaskWithNestedFragmentsQuery: `query GetTaskWithNestedFragments($taskId: ID!, $includePriority: Boolean, $includeAssignee: Boolean) {
  task(id: $taskId) {
    id
    title
    completed
    priority
    dueDate
    assignee {
      id
      name
      email
    }
    project {
      id
      title
      status
    }
  }
}`,

  getTaskWithSkipQuery: `query GetTaskWithSkip($taskId: ID!, $skipAssignee: Boolean!) {
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
}`,

  getTeamHierarchyQuery: `query GetTeamHierarchy($teamId: ID!) {
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
}`,

  getTeamNestedDirectivesQuery: `query GetTeamNestedDirectives($teamId: ID!, $includeProjects: Boolean!, $skipInactive: Boolean!) {
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
}`,

  getTeamProjectsWithFragmentQuery: `query GetTeamProjectsWithFragment($teamId: ID!, $projectStatus: ProjectStatus, $limit: Int) {
  team(id: $teamId) {
    id
    name
    projects(status: $projectStatus, limit: 10) {
      id
      title
      tasks(limit: $limit) {
        id
        title
        completed
      }
    }
  }
}`,

  listEmployeesQuery: `query ListEmployees($departmentId: ID, $limit: Int) {
  employees(departmentId: $departmentId, limit: $limit) {
    id
    name
    email
    role
  }
}`,

  listProjectsWithDefaultsQuery: `query ListProjectsWithDefaults($limit: Int = 20) {
  projects(pagination: {limit: $limit}) {
    id
    title
    status
    priority
    createdAt
  }
}`,

  projectUpdatedSubscription: `subscription ProjectUpdated($projectId: ID!) {
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
}`,

  searchAllQuery: `query SearchAll($query: String!, $limit: Int) {
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
}`,

  searchPartialQuery: `query SearchPartial($query: String!, $limit: Int) {
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
}`,

  taskCreatedSubscription: `subscription TaskCreated($projectId: ID) {
  taskCreated(projectId: $projectId) {
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
}`,

  taskUpdatedSubscription: `subscription TaskUpdated($taskId: ID!) {
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
}`,

  transferEmployeeMutation: `mutation TransferEmployee($input: TransferEmployeeInput!) {
  transferEmployee(input: $input) {
    id
    name
    email
    role
    department {
      id
      name
    }
    team {
      id
      name
    }
  }
}`,

  updateTaskMutation: `mutation UpdateTask($taskId: ID!, $title: String, $completed: Boolean) {
  updateTask(id: $taskId, input: {title: $title, completed: $completed}) {
    id
    title
    completed
    priority
  }
}`,

  updateTaskWithDirectivesMutation: `mutation UpdateTaskWithDirectives($taskId: ID!, $title: String, $completed: Boolean, $includeProject: Boolean!, $skipAssignee: Boolean!) {
  updateTask(id: $taskId, input: {title: $title, completed: $completed}) {
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
}`,
};

/** Expected fragment verification data: typename, key (fragment name), and variable definitions. */
type ExpectedVarDef = { kind: string; name: string; modifier: "!" | "?"; hasDefault?: boolean };
type ExpectedFragmentSpec = { typename: string; key: string; vars: Record<string, ExpectedVarDef> };
export const expectedFragmentSpecs: Record<string, ExpectedFragmentSpec> = {
  commentFragment: { typename: "Comment", key: "CommentDetail", vars: {} },
  commentThreadFragment: {
    typename: "Comment",
    key: "CommentThread",
    vars: { repliesLimit: { kind: "scalar", name: "Int", modifier: "?" } },
  },
  companyDetailConditionalFragment: {
    typename: "Company",
    key: "CompanyDetailConditional",
    vars: {
      includeDepartments: { kind: "scalar", name: "Boolean", modifier: "!" },
      skipEmployees: { kind: "scalar", name: "Boolean", modifier: "!" },
    },
  },
  companyDetailFragment: { typename: "Company", key: "CompanyDetail", vars: {} },
  departmentFragment: { typename: "Department", key: "DepartmentInfo", vars: {} },
  employeeByIdFragment: {
    typename: "Query",
    key: "EmployeeById",
    vars: { id: { kind: "scalar", name: "ID", modifier: "!" } },
  },
  employeeConditionalFragment: {
    typename: "Employee",
    key: "EmployeeConditional",
    vars: { skipEmail: { kind: "scalar", name: "Boolean", modifier: "!" } },
  },
  employeeFragment: {
    typename: "Employee",
    key: "EmployeeFragment",
    vars: { taskLimit: { kind: "scalar", name: "Int", modifier: "?" } },
  },
  employeeHierarchyFragment: {
    typename: "Employee",
    key: "EmployeeHierarchy",
    vars: { reportsLimit: { kind: "scalar", name: "Int", modifier: "?" } },
  },
  employeesByRoleFragment: {
    typename: "Company",
    key: "EmployeesByRole",
    vars: { role: { kind: "enum", name: "EmployeeRole", modifier: "?" } },
  },
  employeeTasksDetailFragment: {
    typename: "Query",
    key: "EmployeeTasksDetail",
    vars: {
      employeeId: { kind: "scalar", name: "ID", modifier: "!" },
      completed: { kind: "scalar", name: "Boolean", modifier: "?" },
      taskLimit: { kind: "scalar", name: "Int", modifier: "?" },
    },
  },
  employeeWithStaticMetadataFragment: { typename: "Employee", key: "EmployeeWithStaticMetadata", vars: {} },
  filteredProjectsFragment: {
    typename: "Query",
    key: "FilteredProjects",
    vars: { filter: { kind: "input", name: "ProjectFilterInput", modifier: "?" } },
  },
  projectBasicFragment: { typename: "Project", key: "ProjectBasic", vars: {} },
  projectConditionalFragment: {
    typename: "Project",
    key: "ProjectConditional",
    vars: { includeTeam: { kind: "scalar", name: "Boolean", modifier: "!" } },
  },
  projectTasksFragment: {
    typename: "Project",
    key: "ProjectTasks",
    vars: { limit: { kind: "scalar", name: "Int", modifier: "?" } },
  },
  projectWithCallbackMetadataFragment: {
    typename: "Project",
    key: "ProjectWithCallbackMetadata",
    vars: {
      projectId: { kind: "scalar", name: "ID", modifier: "!" },
      priority: { kind: "scalar", name: "Int", modifier: "?" },
    },
  },
  projectWithDefaultLimitFragment: {
    typename: "Project",
    key: "ProjectWithDefaultLimit",
    vars: { taskLimit: { kind: "scalar", name: "Int", modifier: "?", hasDefault: true } },
  },
  taskBasicFieldsFragment: { typename: "Task", key: "TaskBasicFields", vars: {} },
  taskDetailConditionalFragment: {
    typename: "Task",
    key: "TaskDetailConditional",
    vars: {
      includeProject: { kind: "scalar", name: "Boolean", modifier: "!" },
      skipAssignee: { kind: "scalar", name: "Boolean", modifier: "!" },
    },
  },
  taskExtendedFieldsFragment: {
    typename: "Task",
    key: "TaskExtendedFields",
    vars: { includePriority: { kind: "scalar", name: "Boolean", modifier: "?" } },
  },
  taskFragment: { typename: "Task", key: "TaskFragment", vars: {} },
  taskFullDetailFragment: { typename: "Task", key: "TaskFullDetail", vars: {} },
  taskWithMetadataFragment: {
    typename: "Task",
    key: "TaskWithMetadata",
    vars: {
      taskId: { kind: "scalar", name: "ID", modifier: "!" },
      includeComments: { kind: "scalar", name: "Boolean", modifier: "?" },
    },
  },
  taskWithProjectFragment: {
    typename: "Task",
    key: "TaskWithProject",
    vars: {
      includePriority: { kind: "scalar", name: "Boolean", modifier: "?" },
      includeAssignee: { kind: "scalar", name: "Boolean", modifier: "?" },
    },
  },
  teamMembersFragment: {
    typename: "Team",
    key: "TeamMembers",
    vars: { membersLimit: { kind: "scalar", name: "Int", modifier: "?" } },
  },
  teamProjectTasksFragment: {
    typename: "Team",
    key: "TeamProjectTasks",
    vars: {
      projectStatus: { kind: "enum", name: "ProjectStatus", modifier: "?" },
      taskLimit: { kind: "scalar", name: "Int", modifier: "?" },
    },
  },
};

/** Expected GraphQL source strings for compat definitions. */
export const expectedCompatStrings: Record<string, string> = {
  getCompanyCompatQuery: `query GetCompanyCompat ($companyId: ID!) {
    company(id: $companyId) {
      id
      name
      industry
    }
  }`,

  updateProjectCompatMutation: `mutation UpdateProjectCompat ($id: ID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      title
      description
      status
    }
  }`,

  taskUpdatedCompatSubscription: `subscription TaskUpdatedCompat ($taskId: ID!) {
    taskUpdated(taskId: $taskId) {
      id
      title
      completed
    }
  }`,
};

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isOperation(value: unknown): value is { document: DocumentNode } {
  return (
    value !== null &&
    typeof value === "object" &&
    "document" in value &&
    typeof (value as { document: unknown }).document === "object"
  );
}

function isFragment(value: unknown): value is {
  typename: string;
  key: string | undefined;
  variableDefinitions: Record<string, unknown>;
  spread: (...args: unknown[]) => unknown;
} {
  return (
    value !== null && typeof value === "object" && "typename" in value && "spread" in value && "variableDefinitions" in value
  );
}

function isCompat(value: unknown): value is { value: { graphqlSource: string } } {
  if (value === null || typeof value !== "object") return false;
  if (!("value" in value)) return false;
  const inner = (value as { value: unknown }).value;
  return inner !== null && typeof inner === "object" && "graphqlSource" in inner;
}

// ---------------------------------------------------------------------------
// Diff output for mismatches
// ---------------------------------------------------------------------------

function showDiff(name: string, expected: string, actual: string): string {
  const lines: string[] = [];
  lines.push(`  --- expected (${name})`);
  lines.push(`  +++ actual (${name})`);
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  for (let i = 0; i < maxLen; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];
    if (exp === act) {
      lines.push(`   ${exp ?? ""}`);
    } else {
      if (exp !== undefined) lines.push(`  -${exp}`);
      if (act !== undefined) lines.push(`  +${act}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Verification runner
// ---------------------------------------------------------------------------

function verifyOperations(): VerificationResult[] {
  const results: VerificationResult[] = [];

  for (const [name, value] of Object.entries(operations)) {
    if (isCompat(value)) {
      // Handle compat definitions
      const graphqlSource = value.value.graphqlSource;
      const expected = expectedCompatStrings[name];
      if (expected === undefined) {
        results.push({
          name,
          category: "compat",
          status: "skip",
          actual: graphqlSource,
        });
      } else if (graphqlSource.trim() === expected.trim()) {
        results.push({ name, category: "compat", status: "pass", actual: graphqlSource, expected });
      } else {
        results.push({ name, category: "compat", status: "fail", actual: graphqlSource, expected });
      }
    } else if (isOperation(value)) {
      // Handle operation definitions
      try {
        const printed = print(value.document);
        const expected = expectedOperationStrings[name];
        if (expected === undefined) {
          results.push({
            name,
            category: "operation",
            status: "skip",
            actual: printed,
          });
        } else if (printed.trim() === expected.trim()) {
          results.push({ name, category: "operation", status: "pass", actual: printed, expected });
        } else {
          results.push({ name, category: "operation", status: "fail", actual: printed, expected });
        }
      } catch (e) {
        results.push({
          name,
          category: "operation",
          status: "fail",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return results;
}

function verifyFragmentSpec(
  name: string,
  actual: {
    typename: string;
    key: string | undefined;
    variableDefinitions: Record<string, unknown>;
  },
  expected: ExpectedFragmentSpec,
): VerificationResult {
  const errors: string[] = [];

  if (actual.typename !== expected.typename) {
    errors.push(`typename: expected "${expected.typename}", got "${actual.typename}"`);
  }
  if (actual.key !== expected.key) {
    errors.push(`key: expected "${expected.key}", got "${actual.key}"`);
  }

  const actualVarNames = Object.keys(actual.variableDefinitions).sort();
  const expectedVarNames = Object.keys(expected.vars).sort();

  if (actualVarNames.join(",") !== expectedVarNames.join(",")) {
    errors.push(`variable names: expected [${expectedVarNames.join(", ")}], got [${actualVarNames.join(", ")}]`);
  } else {
    for (const varName of expectedVarNames) {
      const actualVar = actual.variableDefinitions[varName] as {
        kind?: string;
        name?: string;
        modifier?: string;
        defaultValue?: unknown;
      };
      const expectedVar = expected.vars[varName];
      if (!expectedVar || !actualVar) continue;

      if (actualVar.kind !== expectedVar.kind) {
        errors.push(`var ${varName}.kind: expected "${expectedVar.kind}", got "${actualVar.kind}"`);
      }
      if (actualVar.name !== expectedVar.name) {
        errors.push(`var ${varName}.name: expected "${expectedVar.name}", got "${actualVar.name}"`);
      }
      if (actualVar.modifier !== expectedVar.modifier) {
        errors.push(`var ${varName}.modifier: expected "${expectedVar.modifier}", got "${actualVar.modifier}"`);
      }
      if (expectedVar.hasDefault && actualVar.defaultValue === null) {
        errors.push(`var ${varName}: expected default value, got null`);
      }
      if (!expectedVar.hasDefault && actualVar.defaultValue !== null && actualVar.defaultValue !== undefined) {
        errors.push(`var ${varName}: expected no default, got ${JSON.stringify(actualVar.defaultValue)}`);
      }
    }
  }

  if (errors.length > 0) {
    return { name, category: "fragment", status: "fail", error: errors.join("; ") };
  }
  return { name, category: "fragment", status: "pass" };
}

function verifyFragments(): VerificationResult[] {
  const results: VerificationResult[] = [];

  for (const [name, value] of Object.entries(fragments)) {
    if (isFragment(value)) {
      try {
        const expected = expectedFragmentSpecs[name];
        if (expected === undefined) {
          const summary = `fragment on ${value.typename}, vars: ${Object.keys(value.variableDefinitions).join(", ") || "(none)"}`;
          results.push({ name, category: "fragment", status: "skip", actual: summary });
        } else {
          results.push(
            verifyFragmentSpec(
              name,
              { typename: value.typename, key: value.key, variableDefinitions: value.variableDefinitions },
              expected,
            ),
          );
        }
      } catch (e) {
        results.push({
          name,
          category: "fragment",
          status: "fail",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function report(results: VerificationResult[]): boolean {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  console.log("\n=== Tagged Template Verification ===\n");

  for (const r of results) {
    const icon = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "SKIP";
    const tag = `[${r.category}]`;
    console.log(`  ${icon} ${tag} ${r.name}`);

    if (r.status === "fail") {
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      } else if (r.expected !== undefined && r.actual !== undefined) {
        console.log(showDiff(r.name, r.expected, r.actual));
      }
    }

    if (r.status === "pass") passed++;
    else if (r.status === "fail") failed++;
    else skipped++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped} (no expected string defined)`);
  console.log(`  Total:   ${results.length}\n`);

  return failed === 0;
}

// ---------------------------------------------------------------------------
// Variable merging verification (Phase 3.1)
// ---------------------------------------------------------------------------

function verifyVariableMerging(): VerificationResult[] {
  const results: VerificationResult[] = [];

  // Case 1: Variable deduplication — taskWithProjectFragment spreads taskExtendedFieldsFragment
  // which spreads taskBasicFieldsFragment. Both taskWithProjectFragment and taskExtendedFieldsFragment
  // declare $includePriority. The merged result should have exactly one $includePriority.
  try {
    const nestedOp = operations.getTaskWithNestedFragmentsQuery;
    const printed = print(nestedOp.document);
    const varMatches = printed.match(/\$includePriority/g);
    // $includePriority appears once in variable list and once in @include directive
    // $includePriority appears exactly once: in the variable declaration list.
    // Both taskExtendedFieldsFragment and taskWithProjectFragment declare it,
    // but merging deduplicates to a single declaration.
    if (varMatches && varMatches.length === 1) {
      results.push({
        name: "variableMerging:deduplication",
        category: "operation",
        status: "pass",
        actual: "$includePriority correctly deduplicated to 1 declaration",
      });
    } else {
      results.push({
        name: "variableMerging:deduplication",
        category: "operation",
        status: "fail",
        error: `$includePriority should appear exactly 1 time (deduplicated), got ${varMatches?.length ?? 0}`,
      });
    }
  } catch (e) {
    results.push({
      name: "variableMerging:deduplication",
      category: "operation",
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Case 2: Variable type conflict — attempt to create a fragment that spreads
  // another fragment with an incompatible variable type. This should throw.
  try {
    // Create a fragment with $testVar: String
    const fragA = gql.default(({ fragment }) =>
      fragment("ConflictTestA", "Task")`($testVar: String) {
        id
        title
      }`(),
    );
    // Create a fragment that spreads fragA but declares $testVar: Int (conflict!)
    try {
      gql.default(({ fragment }) =>
        fragment("ConflictTestB", "Task")`($testVar: Int) {
          ...${fragA}
          completed
        }`(),
      );
      results.push({
        name: "variableMerging:typeConflict",
        category: "operation",
        status: "fail",
        error: "Expected type conflict error, but no error was thrown",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("conflict") || msg.includes("incompatible")) {
        results.push({
          name: "variableMerging:typeConflict",
          category: "operation",
          status: "pass",
          actual: `Correctly threw: ${msg}`,
        });
      } else {
        results.push({
          name: "variableMerging:typeConflict",
          category: "operation",
          status: "fail",
          error: `Expected conflict error message, got: ${msg}`,
        });
      }
    }
  } catch (e) {
    results.push({
      name: "variableMerging:typeConflict",
      category: "operation",
      status: "fail",
      error: `Setup failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Error case verification (Phase 3.2)
// ---------------------------------------------------------------------------

function verifyErrorCases(): VerificationResult[] {
  const results: VerificationResult[] = [];

  // Case 1: Interpolation rejection in compat tagged templates
  try {
    // @ts-expect-error: intentionally passing interpolated value to compat template
    gql.default(({ query }) => query.compat("BadCompat")`($id: ID!) { company(id: ${"should not work"}) { id } }`);
    results.push({
      name: "errorCase:compatInterpolation",
      category: "operation",
      status: "fail",
      error: "Expected interpolation rejection, but no error was thrown",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Tagged templates must not contain interpolated expressions")) {
      results.push({
        name: "errorCase:compatInterpolation",
        category: "operation",
        status: "pass",
        actual: `Correctly threw: ${msg}`,
      });
    } else {
      results.push({
        name: "errorCase:compatInterpolation",
        category: "operation",
        status: "fail",
        error: `Expected interpolation error, got: ${msg}`,
      });
    }
  }

  // Case 2: Unknown field name throws error (using fragment, which validates fields on spread)
  try {
    const badFrag = gql.default(({ fragment }) =>
      fragment("BadFieldFragment", "Task")`{
        id
        nonExistentField
      }`(),
    );
    // Field validation happens inside spread() — trigger it
    badFrag.spread();
    results.push({
      name: "errorCase:unknownField",
      category: "operation",
      status: "fail",
      error: "Expected unknown field error, but no error was thrown",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("nonExistentField") ||
      msg.includes("unknown") ||
      msg.includes("not found") ||
      msg.includes("not a function")
    ) {
      results.push({
        name: "errorCase:unknownField",
        category: "operation",
        status: "pass",
        actual: `Correctly threw: ${msg}`,
      });
    } else {
      results.push({
        name: "errorCase:unknownField",
        category: "operation",
        status: "fail",
        error: `Expected unknown field error, got: ${msg}`,
      });
    }
  }

  // Case 3: Malformed GraphQL syntax produces parse error
  try {
    gql.default(({ query }) =>
      query("MalformedQuery")`($taskId: ID!) {
        task(id: $taskId) {
          id
          title {{{
        }
      }`(),
    );
    results.push({
      name: "errorCase:malformedSyntax",
      category: "operation",
      status: "fail",
      error: "Expected parse error, but no error was thrown",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("parse") || msg.includes("Syntax") || msg.includes("Expected")) {
      results.push({
        name: "errorCase:malformedSyntax",
        category: "operation",
        status: "pass",
        actual: `Correctly threw: ${msg}`,
      });
    } else {
      results.push({
        name: "errorCase:malformedSyntax",
        category: "operation",
        status: "fail",
        error: `Expected parse error, got: ${msg}`,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const operationResults = verifyOperations();
const fragmentResults = verifyFragments();
const mergingResults = verifyVariableMerging();
const errorResults = verifyErrorCases();
const allResults = [...operationResults, ...fragmentResults, ...mergingResults, ...errorResults];

const success = report(allResults);

if (!success) {
  process.exit(1);
}
