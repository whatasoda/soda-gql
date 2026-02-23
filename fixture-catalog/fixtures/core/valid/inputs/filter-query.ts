import { gql } from "../../../../graphql-system";

/**
 * Simple filter input with variable references
 */
export const filteredProjectsQuery = gql.default(({ query }) =>
  query("FilteredProjects")`($status: ProjectStatus, $minPriority: Int, $limit: Int) {
    projects(filter: { status: { _eq: $status }, priority: { _gte: $minPriority } }, pagination: { limit: $limit }) {
      id
      title
      status
      priority
    }
  }`(),
);

/**
 * Filter with multiple status values via _in
 */
export const multiStatusFilterQuery = gql.default(({ query }) =>
  query("MultiStatusFilter")`($statuses: [ProjectStatus!], $limit: Int) {
    projects(filter: { status: { _in: $statuses } }, pagination: { limit: $limit }) {
      id
      title
      status
    }
  }`(),
);

/**
 * Query with nested field selections (showing filter capability without vars in nested)
 */
export const nestedFieldQuery = gql.default(({ query }) =>
  query("NestedFieldQuery")`($projectId: ID!) {
    project(id: $projectId) {
      id
      title
      status
      team {
        id
        name
        department {
          id
          name
          budget
        }
      }
    }
  }`(),
);
