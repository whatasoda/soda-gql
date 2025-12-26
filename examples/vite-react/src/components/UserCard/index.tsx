import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { userCardProjection } from "./projection";

type Props = {
  result: InferExecutionResultProjection<typeof userCardProjection>;
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

/**
 * UserCard component that displays user information.
 * Receives parsed projection result with type safety.
 */
export const UserCard = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.user) {
    return <div style={{ padding: "1rem", color: "#888" }}>No user data</div>;
  }

  return (
    <div
      style={{
        padding: "1rem",
        background: "#f5f5f5",
        borderRadius: "4px",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem 0" }}>{result.user.name}</h3>
      <p style={{ margin: 0, color: "#666" }}>{result.user.email}</p>
    </div>
  );
};
