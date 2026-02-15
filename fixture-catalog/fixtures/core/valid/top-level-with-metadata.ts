import { gql } from "../../../graphql-system";

export const employeeFragment = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());

export const pageQuery = gql.default(({ query }) =>
  query`query ProfilePageQuery($departmentId: ID) { employees(departmentId: $departmentId) { id } }`(),
);
