import { createProjection, createProjectionAttachment } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for TaskList component.
 * Fetches tasks for a specific project.
 */
export const taskListFragment = gql
  .default(({ fragment, $var }) =>
    fragment.Query({
      variables: {
        ...$var("projectId").ID("!"),
        ...$var("completed").Boolean("?"),
      },
      metadata: ({ $ }) => ({
        custom: {
          projectId: $.projectId,
        },
      }),
      fields: ({ f, $ }) => ({
        ...f.project({ id: $.projectId })(({ f }) => ({
          ...f.tasks({ completed: $.completed })(({ f }) => ({
            ...f.id(),
            ...f.title(),
            ...f.completed(),
            ...f.priority(),
          })),
        })),
      }),
    }),
  )
  .attach(
    createProjectionAttachment({
      paths: ["$.project.tasks"],
      handle: (result) => {
        if (result.isError()) return { error: result.error, tasks: null };
        if (result.isEmpty()) return { error: null, tasks: null };
        const [tasks] = result.unwrap();
        return { error: null, tasks: tasks ?? [] };
      },
    }),
  );

/**
 * Projection for TaskList component.
 */
export const taskListProjection = createProjection(taskListFragment, {
  paths: ["$.project.tasks"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, tasks: null };
    if (result.isEmpty()) return { error: null, tasks: null };
    const [tasks] = result.unwrap();
    return { error: null, tasks: tasks ?? [] };
  },
});
