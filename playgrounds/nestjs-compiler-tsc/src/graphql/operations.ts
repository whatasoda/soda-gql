import { gql } from "@/graphql-system";

/**
 * Query to get a single employee by ID.
 *
 * This will be transformed to zero-runtime code by the TypeScript compiler plugin.
 */
export const getEmployeeQuery = gql.default(({ query }) =>
  query("GetEmployee")`($employeeId: ID!) {
    employee(id: $employeeId) {
      id
      name
      email
      role
    }
  }`(),
);

/**
 * Query to get all employees.
 *
 * This demonstrates fetching a list of employees with the same fields.
 */
export const getEmployeesQuery = gql.default(({ query }) =>
  query("GetEmployees")`{
    employees {
      id
      name
      email
      role
    }
  }`(),
);
