import { gql } from "../../../../graphql-system";

/**
 * Deep nesting fixture: 5-level query
 * Company → Department → Team → Project → Task
 */
export const companyOverviewQuery = gql.default(({ query }) =>
  query("CompanyOverview")`($companyId: ID!) {
    company(id: $companyId) {
      id
      name
      departments {
        id
        name
        teams {
          id
          name
          projects {
            id
            title
            status
            tasks {
              id
              title
              completed
            }
          }
        }
      }
    }
  }`(),
);

/**
 * Deep nesting with field arguments at multiple levels
 */
export const filteredCompanyQuery = gql.default(({ query }) =>
  query("FilteredCompanyOverview")`($companyId: ID!, $projectStatus: ProjectStatus, $taskCompleted: Boolean, $limit: Int) {
    company(id: $companyId) {
      id
      name
      departments(limit: $limit) {
        id
        name
        teams(limit: $limit) {
          id
          name
          projects(status: $projectStatus, limit: $limit) {
            id
            title
            status
            tasks(completed: $taskCompleted, limit: $limit) {
              id
              title
              completed
            }
          }
        }
      }
    }
  }`(),
);
