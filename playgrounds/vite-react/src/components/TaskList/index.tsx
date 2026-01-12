import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { taskListProjection } from "./fragment";

type Props = {
  result: InferExecutionResultProjection<typeof taskListProjection>;
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

const priorityColors: Record<string, string> = {
  LOW: "#90caf9",
  MEDIUM: "#ffb74d",
  HIGH: "#ef5350",
  URGENT: "#d32f2f",
};

/**
 * TaskList component that displays a list of tasks.
 */
export const TaskList = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.tasks || result.tasks.length === 0) {
    return <div style={{ padding: "1rem", color: "#888" }}>No tasks</div>;
  }

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}>
      <h4 style={{ margin: "0 0 0.5rem 0" }}>Tasks</h4>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {result.tasks.map((task) => (
          <li
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0",
            }}
          >
            <input type="checkbox" checked={task.completed} readOnly style={{ margin: 0 }} />
            <span style={{ textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "#888" : "#333" }}>
              {task.title}
            </span>
            {task.priority && (
              <span
                style={{
                  padding: "0.0625rem 0.375rem",
                  background: priorityColors[task.priority] ?? "#ccc",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "0.625rem",
                  fontWeight: "bold",
                }}
              >
                {task.priority}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
