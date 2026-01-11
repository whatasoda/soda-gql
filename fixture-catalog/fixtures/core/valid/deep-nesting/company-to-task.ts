import { gql } from "../../../../graphql-system";

/**
 * Deep nesting fixture: 5-level query
 * Company → Department → Team → Project → Task
 */
export const companyOverviewQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "CompanyOverview",
    variables: { ...$var("companyId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.company({ id: $.companyId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.departments({})(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.teams({})(({ f }) => ({
            ...f.id(),
            ...f.name(),
            ...f.projects({})(({ f }) => ({
              ...f.id(),
              ...f.title(),
              ...f.status(),
              ...f.tasks({})(({ f }) => ({
                ...f.id(),
                ...f.title(),
                ...f.completed(),
              })),
            })),
          })),
        })),
      })),
    }),
  }),
);

/**
 * Deep nesting with field arguments at multiple levels
 */
export const filteredCompanyQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "FilteredCompanyOverview",
    variables: {
      ...$var("companyId").ID("!"),
      ...$var("projectStatus").ProjectStatus("?"),
      ...$var("taskCompleted").Boolean("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.company({ id: $.companyId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.departments({ limit: $.limit })(({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.teams({ limit: $.limit })(({ f }) => ({
            ...f.id(),
            ...f.name(),
            ...f.projects({ status: $.projectStatus, limit: $.limit })(({ f }) => ({
              ...f.id(),
              ...f.title(),
              ...f.status(),
              ...f.tasks({ completed: $.taskCompleted, limit: $.limit })(({ f }) => ({
                ...f.id(),
                ...f.title(),
                ...f.completed(),
              })),
            })),
          })),
        })),
      })),
    }),
  }),
);
