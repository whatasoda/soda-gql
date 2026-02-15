import { gql } from "../../../graphql-system";

export const createTaskMutation = gql.default(({ mutation }) =>
  mutation`mutation CreateTask($projectId: ID!, $title: String!) {
    createTask(projectId: $projectId, input: { title: $title }) { id title }
  }`(),
);
