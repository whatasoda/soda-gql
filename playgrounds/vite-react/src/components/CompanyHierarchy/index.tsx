import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { companyHierarchyProjection } from "./fragment";

type Props = {
  result: InferExecutionResultProjection<typeof companyHierarchyProjection>;
};

const formatError = (error: NormalizedError): string => {
  switch (error.type) {
    case "graphql-error":
      return error.errors.map((e) => e.message).join(", ");
    case "non-graphql-error":
      return String(error.error);
    case "parse-error":
      return error.errors.map((e) => e.message).join(", ");
  }
};

const statusColors: Record<string, string> = {
  PLANNING: "#90caf9",
  IN_PROGRESS: "#81c784",
  ON_HOLD: "#ffb74d",
  COMPLETED: "#4caf50",
  CANCELLED: "#ef5350",
};

type Company = NonNullable<Props["result"]["company"]>;
type Department = Company["departments"][number];
type Team = Department["teams"][number];
type Project = Team["projects"][number];

/**
 * CompanyHierarchy component that displays the organizational hierarchy.
 * Demonstrates deep nesting: Company → Department → Team → Project (4 levels).
 */
export const CompanyHierarchy = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.company) {
    return <div style={{ padding: "1rem", color: "#888" }}>No company data</div>;
  }

  const { company } = result;

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}>
      {/* Level 1: Company */}
      <div style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🏢</span>
          {company.name}
        </h3>
        {company.industry && <span style={{ color: "#666", fontSize: "0.875rem" }}>{company.industry}</span>}
      </div>

      {/* Level 2: Departments */}
      {company.departments.map((dept: Department) => (
        <div key={dept.id} style={{ marginLeft: "1rem", marginBottom: "0.75rem" }}>
          <h4 style={{ margin: "0 0 0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1rem" }}>📁</span>
            {dept.name}
          </h4>

          {/* Level 3: Teams */}
          {dept.teams.map((team: Team) => (
            <div key={team.id} style={{ marginLeft: "1rem", marginBottom: "0.5rem" }}>
              <h5 style={{ margin: "0 0 0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem" }}>👥</span>
                {team.name}
              </h5>

              {/* Level 4: Projects */}
              {team.projects.length > 0 ? (
                <ul style={{ margin: "0", paddingLeft: "1.5rem", listStyle: "none" }}>
                  {team.projects.map((project: Project) => (
                    <li
                      key={project.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.125rem 0",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem" }}>📋</span>
                      <span>{project.title}</span>
                      <span
                        style={{
                          padding: "0.0625rem 0.375rem",
                          background: statusColors[project.status] ?? "#ccc",
                          color: "white",
                          borderRadius: "4px",
                          fontSize: "0.625rem",
                          fontWeight: "bold",
                        }}
                      >
                        {project.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: "0", marginLeft: "1.5rem", color: "#888", fontSize: "0.875rem" }}>No projects</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
