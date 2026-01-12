import { gql } from "../../../../graphql-system";

/**
 * Recursive relation fixture: Employee → reports → Employee
 */
export const employeeHierarchyFragment = gql.default(({ fragment }) =>
  fragment.Employee({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
      ...f.role(),
      ...f.manager()(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.role(),
      })),
      ...f.reports({})(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.role(),
        // 2-level deep reports
        ...f.reports({})(({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
      })),
    }),
  }),
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
  fragment.Comment({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.body(),
      ...f.author()(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
      ...f.replies({})(({ f }) => ({
        ...f.id(),
        ...f.body(),
        ...f.author()(({ f }) => ({
          ...f.id(),
          ...f.name(),
        })),
        // Nested replies
        ...f.replies({})(({ f }) => ({
          ...f.id(),
          ...f.body(),
        })),
      })),
    }),
  }),
);
