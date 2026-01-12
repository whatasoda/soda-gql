import { gql } from "../../../graphql-system";

export const employeeFragment = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("departmentId").ID("?") },
    fields: ({ f, $ }) => ({ ...f.employees({ departmentId: $.departmentId })(({ f }) => ({ ...f.id() })) }),
  }),
);
