/**
 * Type testing for Phase 1.1: Basic field selection with tagged templates
 * This file verifies that type inference works correctly for the new operations
 */

import type { commentFragment, projectBasicFragment } from "./graphql/fragments";
import type {
  createProjectMutation,
  getProjectWithTasksQuery,
  getTaskBasicQuery,
  taskUpdatedSubscription,
} from "./graphql/operations";

// Query: Basic scalar fields
type TaskBasicInput = typeof getTaskBasicQuery.$infer.input;
type TaskBasicOutput = typeof getTaskBasicQuery.$infer.output;

// Expected types:
// - Input should have { taskId: string }
// - Output should have { task: { id, title, completed, priority } | null }
const _taskInput: TaskBasicInput = { taskId: "123" };
const _taskOutput: TaskBasicOutput = {
  task: {
    id: "1",
    title: "Test",
    completed: true,
    priority: "HIGH",
  },
};

// Query: Nested object fields
type ProjectWithTasksInput = typeof getProjectWithTasksQuery.$infer.input;
type ProjectWithTasksOutput = typeof getProjectWithTasksQuery.$infer.output;

const _projectInput: ProjectWithTasksInput = { projectId: "456" };
const _projectOutput: ProjectWithTasksOutput = {
  project: {
    id: "1",
    title: "Project",
    description: "Desc",
    status: "IN_PROGRESS",
    tasks: [
      {
        id: "1",
        title: "Task",
        completed: false,
        priority: "MEDIUM",
        dueDate: "2026-01-01",
      },
    ],
  },
};

// Mutation: Complex input type
type CreateProjectInput = typeof createProjectMutation.$infer.input;
type CreateProjectOutput = typeof createProjectMutation.$infer.output;

const _createInput: CreateProjectInput = {
  input: {
    title: "New Project",
    teamId: "team-1",
  },
};

// Subscription: Real-time updates
type TaskUpdatedInput = typeof taskUpdatedSubscription.$infer.input;
type TaskUpdatedOutput = typeof taskUpdatedSubscription.$infer.output;

const _subInput: TaskUpdatedInput = { taskId: "789" };

// Fragment: Scalar and nested fields
type ProjectBasicOutput = typeof projectBasicFragment.$infer.output;
const _fragmentOutput: ProjectBasicOutput = {
  id: "1",
  title: "Project",
  description: null,
  status: "PLANNING",
  priority: null,
  createdAt: "2026-01-01",
  updatedAt: null,
};

// Fragment: Multi-level nesting
type CommentOutput = typeof commentFragment.$infer.output;
const _commentOutput: CommentOutput = {
  id: "1",
  body: "Comment",
  createdAt: "2026-01-01",
  author: {
    id: "1",
    name: "Author",
    email: "author@example.com",
  },
  task: {
    id: "1",
    title: "Task",
  },
};

// Export to verify types are correct
export type {
  TaskBasicInput,
  TaskBasicOutput,
  ProjectWithTasksInput,
  ProjectWithTasksOutput,
  CreateProjectInput,
  CreateProjectOutput,
  TaskUpdatedInput,
  TaskUpdatedOutput,
  ProjectBasicOutput,
  CommentOutput,
};
