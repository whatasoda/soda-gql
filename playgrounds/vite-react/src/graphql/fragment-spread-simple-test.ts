/**
 * Simple runtime test for fragment spread with explicit variables
 */

import type {
  getEmployeeWithFragmentQuery,
  getProjectWithMultipleFragmentsQuery,
  getTeamProjectsWithFragmentQuery,
} from "./operations";

// Test 1: Check that operation has correct input type
const test1Input: (typeof getEmployeeWithFragmentQuery)["$infer"]["input"] = {
  employeeId: "123",
  completed: true,
  taskLimit: 10,
};

console.log("Test 1 - getEmployeeWithFragmentQuery input:", test1Input);

// Test 2: Check multiple fragments
const test2Input: (typeof getProjectWithMultipleFragmentsQuery)["$infer"]["input"] = {
  projectId: "456",
  limit: 5,
  includeProject: true,
  skipAssignee: false,
};

console.log("Test 2 - getProjectWithMultipleFragmentsQuery input:", test2Input);

// Test 3: Check mixed variables
const test3Input: (typeof getTeamProjectsWithFragmentQuery)["$infer"]["input"] = {
  teamId: "789",
  projectStatus: "IN_PROGRESS",
  limit: 20,
};

console.log("Test 3 - getTeamProjectsWithFragmentQuery input:", test3Input);

console.log("\n✅ All fragment spread operations compile with correct types!");
