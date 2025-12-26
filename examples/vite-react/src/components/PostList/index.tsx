import type { InferExecutionResultProjection, NormalizedError } from "@soda-gql/colocation-tools";
import type { postListProjection } from "./fragment";

type Props = {
  result: InferExecutionResultProjection<typeof postListProjection>;
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
 * PostList component that displays a list of posts.
 */
export const PostList = ({ result }: Props) => {
  if (result.error) {
    return <div style={{ padding: "1rem", background: "#fee", borderRadius: "4px" }}>Error: {formatError(result.error)}</div>;
  }

  if (!result.posts || result.posts.length === 0) {
    return <div style={{ padding: "1rem", color: "#888" }}>No posts</div>;
  }

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}>
      <h4 style={{ margin: "0 0 0.5rem 0" }}>Posts</h4>
      <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
        {result.posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
};
