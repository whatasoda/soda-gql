import { gql } from "../../../../graphql-system";

/**
 * Simple filter input with variable references
 */
export const filteredProjectsQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "FilteredProjects",
    variables: {
      ...$var("status").ProjectStatus("?"),
      ...$var("minPriority").Int("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.projects({
        filter: {
          status: { _eq: $.status },
          priority: { _gte: $.minPriority },
        },
        pagination: { limit: $.limit },
      })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.status(),
        ...f.priority(),
      })),
    }),
  }),
);

/**
 * Filter with multiple status values via _in
 */
export const multiStatusFilterQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "MultiStatusFilter",
    variables: {
      ...$var("statuses").ProjectStatus("![]?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.projects({
        filter: {
          status: { _in: $.statuses },
        },
        pagination: { limit: $.limit },
      })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.status(),
      })),
    }),
  }),
);

/**
 * Query with nested field selections (showing filter capability without vars in nested)
 */
export const nestedFieldQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "NestedFieldQuery",
    variables: {
      ...$var("projectId").ID("!"),
    },
    fields: ({ f, $ }) => ({
      ...f.project({ id: $.projectId })(({ f }) => ({
        ...f.id(),
        ...f.title(),
        ...f.status(),
        ...f.team()(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.department()(({ f }) => ({
            ...f.id(),
            ...f.name(),
            ...f.budget(),
          })),
        })),
      })),
    }),
  }),
);
