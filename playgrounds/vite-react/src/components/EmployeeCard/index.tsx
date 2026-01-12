import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { employeeCardProjection } from "./fragment";

type Props = {
  result: InferExecutionResultProjection<typeof employeeCardProjection>;
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

const roleColors: Record<string, string> = {
  ENGINEER: "#4a90d9",
  MANAGER: "#7b68ee",
  DIRECTOR: "#9932cc",
  EXECUTIVE: "#dc143c",
  INTERN: "#32cd32",
};

/**
 * EmployeeCard component that displays employee information.
 * Receives parsed projection result with type safety.
 */
export const EmployeeCard = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.employee) {
    return <div style={{ padding: "1rem", color: "#888" }}>No employee data</div>;
  }

  const { employee } = result;
  const roleColor = roleColors[employee.role] ?? "#666";

  return (
    <div
      style={{
        padding: "1rem",
        background: "#f5f5f5",
        borderRadius: "4px",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem 0" }}>{employee.name}</h3>
      <p style={{ margin: "0 0 0.25rem 0", color: "#666" }}>{employee.email}</p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span
          style={{
            padding: "0.125rem 0.5rem",
            background: roleColor,
            color: "white",
            borderRadius: "4px",
            fontSize: "0.75rem",
          }}
        >
          {employee.role}
        </span>
        {employee.department && <span style={{ color: "#888", fontSize: "0.875rem" }}>{employee.department.name}</span>}
      </div>
    </div>
  );
};
