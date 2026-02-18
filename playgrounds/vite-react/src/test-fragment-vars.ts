/**
 * Type testing for Phase 1.2: Fragment variables and arguments
 * This file verifies that fragment variable types are correctly inferred
 */
import type {
  employeeByIdFragment,
  employeesByRoleFragment,
  employeeTasksDetailFragment,
  filteredProjectsFragment,
  projectTasksFragment,
  teamProjectTasksFragment,
} from "./graphql/fragments";

// Fragment with required variable ($id: ID!)
type EmployeeByIdInput = typeof employeeByIdFragment.$infer.input;
const _requiredInput: EmployeeByIdInput = { id: "123" };
// Should error if id is missing:
// const _missingRequired: EmployeeByIdInput = {}; // ❌ Type error expected

// Fragment with optional variable ($limit: Int)
type ProjectTasksInput = typeof projectTasksFragment.$infer.input;
const _optionalInput1: ProjectTasksInput = { limit: 10 };
const _optionalInput2: ProjectTasksInput = {}; // ✓ Optional, so empty object is valid

// Fragment with enum variable ($role: EmployeeRole)
type EmployeesByRoleInput = typeof employeesByRoleFragment.$infer.input;
const _enumInput1: EmployeesByRoleInput = { role: "ENGINEER" };
const _enumInput2: EmployeesByRoleInput = { role: "MANAGER" };
const _enumInput3: EmployeesByRoleInput = {}; // ✓ Optional

// Fragment with complex input variable ($filter: ProjectFilterInput)
type FilteredProjectsInput = typeof filteredProjectsFragment.$infer.input;
const _complexInput: FilteredProjectsInput = {
  filter: {
    title: { _contains: "API" },
    status: { _eq: "IN_PROGRESS" },
  },
};
const _complexInput2: FilteredProjectsInput = {}; // ✓ Optional

// Fragment with multiple variables
type EmployeeTasksDetailInput = typeof employeeTasksDetailFragment.$infer.input;
const _multipleVars1: EmployeeTasksDetailInput = {
  employeeId: "emp-1",
  completed: true,
  taskLimit: 5,
};
const _multipleVars2: EmployeeTasksDetailInput = {
  employeeId: "emp-2", // Only required field
};
// Should error if employeeId is missing:
// const _missingMultipleRequired: EmployeeTasksDetailInput = { completed: true }; // ❌ Type error expected

// Fragment with nested variable usage
type TeamProjectTasksInput = typeof teamProjectTasksFragment.$infer.input;
const _nestedInput: TeamProjectTasksInput = {
  projectStatus: "IN_PROGRESS",
  taskLimit: 3,
};

// Export to verify types are correct
export type {
  EmployeeByIdInput,
  ProjectTasksInput,
  EmployeesByRoleInput,
  FilteredProjectsInput,
  EmployeeTasksDetailInput,
  TeamProjectTasksInput,
};
