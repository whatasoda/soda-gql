import { gql } from "../../../graphql-system";

export const employeeFragment = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("departmentId").ID("?") },
    fields: ({ f, $ }) => ({ ...f.employees({ departmentId: $.departmentId })(({ f }) => ({ ...f.id() })) }),
  }),
);
