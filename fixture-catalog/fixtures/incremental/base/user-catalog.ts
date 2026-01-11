import { gql } from "../../../graphql-system";

export const collections = {
  byDepartment: gql.default(({ query, $var }) =>
    query.operation({
      name: "EmployeesByDepartment",
      variables: { ...$var("departmentId").ID("?") },
      fields: ({ f, $ }) => ({ ...f.employees({ departmentId: $.departmentId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
    }),
  ),
};
