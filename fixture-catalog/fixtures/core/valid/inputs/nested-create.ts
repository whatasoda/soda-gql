import { gql } from "../../../../graphql-system";

/**
 * Complex nested input: CreateProjectInput with nested CreateTaskInput
 */
export const createProjectWithTasksMutation = gql.default(({ mutation }) =>
  mutation`mutation CreateProjectWithTasks($teamId: ID!, $title: String!, $description: String, $status: ProjectStatus, $priority: Int) {
    createProject(input: { teamId: $teamId, title: $title, description: $description, status: $status, priority: $priority, tasks: [{ title: "Initial task" }, { title: "Second task", priority: HIGH }] }) {
      id
      title
      status
      tasks {
        id
        title
      }
    }
  }`(),
);

/**
 * Update with nested input
 */
export const updateTaskMutation = gql.default(({ mutation }) =>
  mutation`mutation UpdateTask($taskId: ID!, $title: String, $completed: Boolean, $priority: TaskPriority) {
    updateTask(id: $taskId, input: { title: $title, completed: $completed, priority: $priority }) {
      id
      title
      completed
      priority
    }
  }`(),
);
