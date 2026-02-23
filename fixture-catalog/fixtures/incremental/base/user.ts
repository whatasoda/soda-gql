import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment("UserFragment", "Employee")`($completed: Boolean) { id name tasks(completed: $completed) { id title } }`(),
);

export const userRemote = {
  forIterate: gql.default(({ fragment }) => fragment("ForIterateFragment", "Employee")`{ id name }`()),
};

export const usersQuery = gql.default(({ query }) =>
  query("GetUsers")`($departmentId: ID, $limit: Int) {
    employees(departmentId: $departmentId, limit: $limit) { id name }
  }`(),
);

export const usersQueryCatalog = {
  byId: gql.default(({ query }) =>
    query("GetUsersById")`($employeeId: ID!) { employee(id: $employeeId) { id name } }`(),
  ),
};
