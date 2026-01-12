import { gql } from "@/graphql-system";

/**
 * Query to get a single employee by ID.
 *
 * This will be transformed to zero-runtime code by the TypeScript compiler plugin.
 */
export const getEmployeeQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployee",
    variables: { ...$var("employeeId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
        ...f.role(),
      })),
    }),
  }),
);

/**
 * Query to get all employees.
 *
 * This demonstrates fetching a list of employees with the same fields.
 */
export const getEmployeesQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetEmployees",
    fields: ({ f }) => ({
      ...f.employees({})(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
        ...f.role(),
      })),
    }),
  }),
);
