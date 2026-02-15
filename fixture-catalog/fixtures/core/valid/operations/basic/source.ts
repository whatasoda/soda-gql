import { gql } from "../../../../../graphql-system";

export const profileQuery = gql.default(({ query }) =>
  query`query ProfileQuery($employeeId: ID!) { employee(id: $employeeId) { id name } }`(),
);

export const updateTaskMutation = gql.default(({ mutation }) =>
  mutation`mutation UpdateTaskMutation($taskId: ID!, $title: String) {
    updateTask(id: $taskId, input: { title: $title }) { id title }
  }`(),
);

export const query1 = gql.default(({ query }) =>
  query`query Query1 { employees { id } }`(),
);

export const query2 = gql.default(({ query }) =>
  query`query Query2 { employees { name } }`(),
);
