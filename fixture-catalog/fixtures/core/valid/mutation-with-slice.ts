import { gql } from "../../../graphql-system";

export const pageAction = gql.default(({ mutation }) =>
  mutation("PageAction")`($projectId: ID!, $title: String!) {
    createTask(projectId: $projectId, input: { title: $title }) { id }
  }`(),
);
