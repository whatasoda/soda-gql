import { gql } from "../../../graphql-system";

export const employeeFragment = gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());

export const pageQuery = gql.default(({ query }) =>
  query("ProfilePageQuery")`($departmentId: ID) { employees(departmentId: $departmentId) { id } }`(),
);
