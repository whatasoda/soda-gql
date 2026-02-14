import { gql } from "../../../../graphql-system";

/**
 * Recursive relation fixture: Employee → reports → Employee
 */
export const employeeHierarchyFragment = gql.default(({ fragment }) =>
  fragment`fragment EmployeeHierarchyFragment on Employee {
    id
    name
    role
    manager {
      id
      name
      role
    }
    reports {
      id
      name
      role
      reports {
        id
        name
      }
    }
  }`(),
);

/**
 * Recursive relation query
 */
export const employeeTreeQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "EmployeeTree",
    variables: { ...$var("employeeId").ID("!"), ...$var("reportsLimit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.role(),
        ...f.manager()(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.manager()(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        })),
        ...f.reports({ limit: $.reportsLimit })(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.reports({ limit: $.reportsLimit })(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),
        })),
      })),
    }),
  }),
);

/**
 * Recursive comment replies
 */
export const commentThreadFragment = gql.default(({ fragment }) =>
  fragment`fragment CommentThreadFragment on Comment {
    id
    body
    author {
      id
      name
    }
    replies {
      id
      body
      author {
        id
        name
      }
      replies {
        id
        body
      }
    }
  }`(),
);
