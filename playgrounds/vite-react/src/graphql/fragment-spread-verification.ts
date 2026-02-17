/**
 * Phase 2.1 Verification: Fragment spread with direct interpolation
 *
 * IMPORTANT FINDING: Fragment variables are NOT automatically merged!
 *
 * Parent operations must EXPLICITLY declare all variables using $var(),
 * including those required by child fragments. This explicit pattern makes
 * dependencies clear and prevents unexpected variable pollution.
 *
 * Pattern: Fragments declare their requirements; operations declare their contract.
 *
 * Verified Behavior:
 * 1. getEmployeeWithFragmentQuery: Explicitly declares $employeeId, $completed, $taskLimit
 *    - Fragment employeeTasksDetailFragment defines these variables
 *    - Operation must re-declare them to use them
 *    - Variables are passed via .spread({ employeeId: $.employeeId, ... })
 *
 * 2. getProjectWithMultipleFragmentsQuery: Explicitly declares all needed variables
 *    - $projectId (operation's own)
 *    - $limit (for projectTasksFragment)
 *    - $includeProject, $skipAssignee (for taskDetailConditionalFragment)
 *
 * 3. getTeamProjectsWithFragmentQuery: Mixed operation and fragment variables
 *    - $teamId, $projectStatus (operation's own)
 *    - $limit (for projectTasksFragment)
 *
 * All operations compile successfully and have correct type inference.
 * See fragment-spread-simple-test.ts for runtime verification.
 */
