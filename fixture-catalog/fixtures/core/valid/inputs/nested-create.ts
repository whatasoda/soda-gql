import { gql } from "../../../../graphql-system";

/**
 * Complex nested input: CreateProjectInput with nested CreateTaskInput
 */
export const createProjectWithTasksMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "CreateProjectWithTasks",
    variables: {
      ...$var("teamId").ID("!"),
      ...$var("title").String("!"),
      ...$var("description").String("?"),
      ...$var("status").ProjectStatus("?"),
      ...$var("priority").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.createProject({
        input: {
          teamId: $.teamId,
          title: $.title,
          description: $.description,
          status: $.status,
          priority: $.priority,
          // Nested task creation
          tasks: [
            { title: "Initial task" },
            { title: "Second task", priority: "HIGH" as const },
          ],
        },
      })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.status(),
        ...f.tasks({})(({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      })),
    }),
  }),
);

/**
 * Update with nested input
 */
export const updateTaskMutation = gql.default(({ mutation, $var }) =>
  mutation.operation({
    name: "UpdateTask",
    variables: {
      ...$var("taskId").ID("!"),
      ...$var("title").String("?"),
      ...$var("completed").Boolean("?"),
      ...$var("priority").TaskPriority("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.updateTask({
        id: $.taskId,
        input: {
          title: $.title,
          completed: $.completed,
          priority: $.priority,
        },
      })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.completed(),
        ...f.priority(),
      })),
    }),
  }),
);
