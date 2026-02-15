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
export const employeeTreeQuery = gql.default(({ query }) =>
  query`query EmployeeTree($employeeId: ID!, $reportsLimit: Int) {
    employee(id: $employeeId) {
      id
      name
      role
      manager {
        id
        name
        manager {
          id
          name
        }
      }
      reports(limit: $reportsLimit) {
        id
        name
        reports(limit: $reportsLimit) {
          id
          name
        }
      }
    }
  }`(),
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
