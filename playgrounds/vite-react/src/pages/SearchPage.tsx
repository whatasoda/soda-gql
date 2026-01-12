import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { SearchResults } from "../components/SearchResults";
import { searchResultsFragment, searchResultsProjection } from "../components/SearchResults/fragment";
import { CompanyHierarchy } from "../components/CompanyHierarchy";
import { companyHierarchyFragment, companyHierarchyProjection } from "../components/CompanyHierarchy/fragment";

/**
 * Parser for search results
 */
const parseSearchResult = createExecutionResultParser({
  search: { projection: searchResultsProjection },
});

/**
 * Parser for company hierarchy
 */
const parseHierarchyResult = createExecutionResultParser({
  hierarchy: { projection: companyHierarchyProjection },
});

/**
 * SearchPage demonstrates advanced GraphQL features:
 * 1. Union types (SearchResult = Employee | Project | Task | Comment)
 * 2. Deep nesting (Company → Department → Team → Project)
 */
export const SearchPage = () => {
  // Mock search results demonstrating Union type handling
  const searchMockResult = parseSearchResult({
    type: "graphql",
    body: {
      data: {
        search_search: [
          { __typename: "Employee", id: "e1", name: "Alice Johnson", email: "alice@company.com", role: "MANAGER" },
          { __typename: "Project", id: "p1", title: "Website Redesign", status: "IN_PROGRESS", priority: 2 },
          { __typename: "Task", id: "t1", title: "Update landing page", completed: false, priority: "HIGH" },
          { __typename: "Comment", id: "c1", body: "Great progress on this!" },
          { __typename: "Employee", id: "e2", name: "Bob Smith", email: "bob@company.com", role: "ENGINEER" },
          { __typename: "Task", id: "t2", title: "Review pull request", completed: true, priority: "MEDIUM" },
        ],
      },
    },
  });

  // Mock company hierarchy demonstrating deep nesting
  const hierarchyMockResult = parseHierarchyResult({
    type: "graphql",
    body: {
      data: {
        hierarchy_company: {
          id: "c1",
          name: "TechCorp Inc.",
          industry: "Technology",
          departments: [
            {
              id: "d1",
              name: "Engineering",
              teams: [
                {
                  id: "t1",
                  name: "Frontend Team",
                  projects: [
                    { id: "p1", title: "Website Redesign", status: "IN_PROGRESS" },
                    { id: "p2", title: "Mobile App", status: "PLANNING" },
                  ],
                },
                {
                  id: "t2",
                  name: "Backend Team",
                  projects: [
                    { id: "p3", title: "API Gateway", status: "COMPLETED" },
                    { id: "p4", title: "Database Migration", status: "ON_HOLD" },
                  ],
                },
              ],
            },
            {
              id: "d2",
              name: "Product",
              teams: [
                {
                  id: "t3",
                  name: "Design Team",
                  projects: [{ id: "p5", title: "Design System", status: "IN_PROGRESS" }],
                },
              ],
            },
          ],
        },
      },
    },
  });

  return (
    <div>
      <h2>Advanced Features Demo</h2>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        This page demonstrates advanced GraphQL features supported by soda-gql.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h3>Union Types: Search Results</h3>
        <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
          The <code>search</code> query returns a union type: <code>SearchResult = Employee | Project | Task | Comment</code>
        </p>
        <SearchResults result={searchMockResult.search} />
      </section>

      <section>
        <h3>Deep Nesting: Company Hierarchy</h3>
        <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
          4-level deep query: <code>Company → Department → Team → Project</code>
        </p>
        <CompanyHierarchy result={hierarchyMockResult.hierarchy} />
      </section>
    </div>
  );
};
