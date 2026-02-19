/**
 * Type verification file for Phase 1.3: Directives in tagged templates
 *
 * This file verifies that:
 * 1. @skip and @include directives compile without errors
 * 2. Variable references work correctly within directives
 * 3. Directive fields are properly typed
 */

import type {
  companyDetailConditionalFragment,
  employeeConditionalFragment,
  projectConditionalFragment,
  taskDetailConditionalFragment,
} from "./fragments";
import type {
  getEmployeeConditionalQuery,
  getProjectWithIncludeQuery,
  getTaskWithSkipQuery,
  getTeamNestedDirectivesQuery,
  updateTaskWithDirectivesMutation,
} from "./operations";

// ============================================================================
// Type verification: Operations with directives
// ============================================================================

/**
 * Verify @skip directive with variable
 * Input type should include $skipAssignee boolean variable
 */
const taskWithSkipInput: typeof getTaskWithSkipQuery.$infer.input = {
  taskId: "task-1",
  skipAssignee: true,
};

/**
 * Verify @include directive with variable
 * Input type should include $includeTeam boolean variable
 */
const projectWithIncludeInput: typeof getProjectWithIncludeQuery.$infer.input = {
  projectId: "project-1",
  includeTeam: false,
};

/**
 * Verify multiple directives in one operation
 * Input type should include both $includeTasks and $skipComments boolean variables
 */
const employeeConditionalInput: typeof getEmployeeConditionalQuery.$infer.input = {
  employeeId: "emp-1",
  includeTasks: true,
  skipComments: false,
};

/**
 * Verify nested directives
 * Input type should include $includeProjects and $skipInactive boolean variables
 */
const teamNestedDirectivesInput: typeof getTeamNestedDirectivesQuery.$infer.input = {
  teamId: "team-1",
  includeProjects: true,
  skipInactive: false,
};

/**
 * Verify directives in mutation response
 * Input type should include mutation args plus directive variables
 */
const updateTaskWithDirectivesInput: typeof updateTaskWithDirectivesMutation.$infer.input = {
  taskId: "task-1",
  title: "Updated title",
  completed: true,
  includeProject: true,
  skipAssignee: false,
};

// ============================================================================
// Type verification: Fragments with directives
// ============================================================================

/**
 * Verify fragment with @skip directive
 * Fragment input should include $skipEmail boolean variable
 */
const employeeConditionalFragmentInput: typeof employeeConditionalFragment.$infer.input = {
  skipEmail: true,
};

/**
 * Verify fragment with @include directive
 * Fragment input should include $includeTeam boolean variable
 */
const projectConditionalFragmentInput: typeof projectConditionalFragment.$infer.input = {
  includeTeam: false,
};

/**
 * Verify fragment with both directives
 * Fragment input should include both $includeProject and $skipAssignee boolean variables
 */
const taskDetailConditionalFragmentInput: typeof taskDetailConditionalFragment.$infer.input = {
  includeProject: true,
  skipAssignee: false,
};

/**
 * Verify fragment with nested directives
 * Fragment input should include $includeDepartments and $skipEmployees boolean variables
 */
const companyDetailConditionalFragmentInput: typeof companyDetailConditionalFragment.$infer.input = {
  includeDepartments: true,
  skipEmployees: false,
};

// ============================================================================
// Compilation check: All above assignments should type-check correctly
// ============================================================================

// Consume all variables to avoid unused variable warnings
export const allDirectiveInputs = {
  taskWithSkipInput,
  projectWithIncludeInput,
  employeeConditionalInput,
  teamNestedDirectivesInput,
  updateTaskWithDirectivesInput,
  employeeConditionalFragmentInput,
  projectConditionalFragmentInput,
  taskDetailConditionalFragmentInput,
  companyDetailConditionalFragmentInput,
};

export const directiveVerificationComplete = true;
