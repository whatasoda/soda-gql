import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment`fragment UserFragment($completed: Boolean) on Employee { id name tasks(completed: $completed) { id title } }`(),
);

export const userRemote = {
  forIterate: gql.default(({ fragment }) => fragment`fragment ForIterateFragment on Employee { id name }`()),
};

export const usersQuery = gql.default(({ query }) =>
  query`query GetUsers($departmentId: ID, $limit: Int) {
    employees(departmentId: $departmentId, limit: $limit) { id name }
  }`(),
);

export const usersQueryCatalog = {
  byId: gql.default(({ query }) =>
    query`query GetUsersById($employeeId: ID!) { employee(id: $employeeId) { id name } }`(),
  ),
};
