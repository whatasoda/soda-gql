import { gql } from "../../../graphql-system";

export const collections = {
  byDepartment: gql.default(({ query }) =>
    query`query EmployeesByDepartment($departmentId: ID) { employees(departmentId: $departmentId) { id name } }`(),
  ),
};
