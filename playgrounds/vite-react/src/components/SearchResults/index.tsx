import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { searchResultsProjection } from "./fragment";

type Props = {
  result: InferExecutionResultProjection<typeof searchResultsProjection>;
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

const typeColors: Record<string, string> = {
  Employee: "#4a90d9",
  Project: "#7b68ee",
  Task: "#32cd32",
  Comment: "#ff8c00",
};

type SearchResultItem = NonNullable<Props["result"]["results"]>[number];

/**
 * Render a single search result based on its __typename.
 * Demonstrates discriminated union pattern in React.
 */
const SearchResultCard = ({ item }: { item: SearchResultItem }) => {
  const typeColor = typeColors[item.__typename] ?? "#888";

  return (
    <div
      style={{
        padding: "0.75rem",
        background: "#f9f9f9",
        borderRadius: "4px",
        borderLeft: `4px solid ${typeColor}`,
        marginBottom: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <span
          style={{
            padding: "0.125rem 0.5rem",
            background: typeColor,
            color: "white",
            borderRadius: "4px",
            fontSize: "0.625rem",
            fontWeight: "bold",
          }}
        >
          {item.__typename}
        </span>
        <span style={{ color: "#888", fontSize: "0.75rem" }}>#{item.id}</span>
      </div>

      {/* Type-specific rendering using discriminated union */}
      {item.__typename === "Employee" && (
        <div>
          <strong>{item.name}</strong>
          <div style={{ color: "#666", fontSize: "0.875rem" }}>
            {item.email} · {item.role}
          </div>
        </div>
      )}

      {item.__typename === "Project" && (
        <div>
          <strong>{item.title}</strong>
          <div style={{ color: "#666", fontSize: "0.875rem" }}>
            Status: {item.status} · Priority: {item.priority}
          </div>
        </div>
      )}

      {item.__typename === "Task" && (
        <div>
          <strong style={{ textDecoration: item.completed ? "line-through" : "none" }}>{item.title}</strong>
          <div style={{ color: "#666", fontSize: "0.875rem" }}>
            {item.completed ? "Completed" : "Pending"} · {item.priority}
          </div>
        </div>
      )}

      {item.__typename === "Comment" && (
        <div>
          <p style={{ margin: 0, fontStyle: "italic" }}>"{item.body}"</p>
        </div>
      )}
    </div>
  );
};

/**
 * SearchResults component that displays search results with Union type handling.
 * Demonstrates how to work with GraphQL Union types in soda-gql.
 */
export const SearchResults = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.results || result.results.length === 0) {
    return <div style={{ padding: "1rem", color: "#888" }}>No results found</div>;
  }

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}>
      <h4 style={{ margin: "0 0 0.75rem 0" }}>Search Results ({result.results.length})</h4>
      {result.results.map((item) => (
        <SearchResultCard key={`${item.__typename}-${item.id}`} item={item} />
      ))}
    </div>
  );
};
