import { gql } from "@/graphql-system";

/**
 * Employee fragment with nested tasks
 * Demonstrates fragment definition with variables and nested field selections
 */
export const employeeFragment = gql.default(({ fragment, $var }) =>
  fragment.Employee({
    variables: { ...$var("taskLimit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
      ...f.role(),
      ...f.tasks({ limit: $.taskLimit })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.completed(),
        ...f.priority(),
      })),
    }),
  }),
);

/**
 * Simple task fragment without variables
 */
export const taskFragment = gql.default(({ fragment }) =>
  fragment.Task({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.title(),
      ...f.completed(),
      ...f.priority(),
      ...f.dueDate(),
    }),
  }),
);
