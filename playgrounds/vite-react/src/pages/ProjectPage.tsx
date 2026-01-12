import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";
import { EmployeeCard } from "../components/EmployeeCard";
import { employeeCardFragment, employeeCardProjection } from "../components/EmployeeCard/fragment";
import { TaskList } from "../components/TaskList";
import { taskListFragment } from "../components/TaskList/fragment";

/**
 * Operation that composes multiple fragments using $colocate.
 * Each label must match the parser's label for result distribution.
 */
export const projectPageQuery = gql.default(({ query, $var, $colocate }) =>
  query.operation({
    name: "ProjectPage",
    variables: {
      ...$var("projectId").ID("!"),
      ...$var("leadId").ID("!"),
    },
    fields: ({ $ }) =>
      $colocate({
        employeeCard: employeeCardFragment.spread({ employeeId: $.leadId }),
        taskList: taskListFragment.spread({ projectId: $.projectId }),
      }),
  }),
);

/**
 * Parser that maps execution results to projections.
 * Labels must match those used in $colocate.
 */
const parseResult = createExecutionResultParser({
  employeeCard: { projection: employeeCardProjection },
  taskList: taskListFragment,
});

/**
 * ProjectPage demonstrates the colocation pattern:
 * 1. Each component defines its data requirements (fragment + projection)
 * 2. $colocate composes fragments with unique prefixes
 * 3. Parser distributes results back to each component
 */
export const ProjectPage = () => {
  // Mock execution result for demonstration
  const mockResult = parseResult({
    type: "graphql",
    body: {
      data: {
        // Fields are prefixed by $colocate labels
        employeeCard_employee: {
          id: "1",
          name: "Alice Johnson",
          email: "alice@company.com",
          role: "MANAGER",
          department: {
            id: "d1",
            name: "Engineering",
          },
        },
        taskList_project: {
          tasks: [
            { id: "t1", title: "Implement user authentication", completed: true, priority: "HIGH" },
            { id: "t2", title: "Design database schema", completed: true, priority: "MEDIUM" },
            { id: "t3", title: "Write API documentation", completed: false, priority: "LOW" },
            { id: "t4", title: "Deploy to production", completed: false, priority: "URGENT" },
          ],
        },
      },
    },
  });

  return (
    <div>
      <h2>Project Page (Colocation Demo)</h2>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        This page demonstrates composing multiple colocated fragments with @soda-gql/colocation-tools.
      </p>
      <h3 style={{ margin: "1rem 0 0.5rem 0" }}>Project Lead</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <EmployeeCard result={mockResult.employeeCard} />
        <TaskList result={mockResult.taskList} />
      </div>
    </div>
  );
};
