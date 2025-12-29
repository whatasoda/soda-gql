import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";
import { PostList } from "../components/PostList";
import { postListFragment } from "../components/PostList/fragment";
import { UserCard } from "../components/UserCard";
import { userCardFragment, userCardProjection } from "../components/UserCard/fragment";

/**
 * Operation that composes multiple fragments using $colocate.
 * Each label must match the parser's label for result distribution.
 */
export const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({
    name: "UserPage",
    variables: { ...$var("userId").ID("!") },
    fields: ({ $ }) =>
      $colocate({
        userCard: userCardFragment.embed({ userId: $.userId }),
        postList: postListFragment.embed({ userId: $.userId }),
      }),
  }),
);

/**
 * Parser that maps execution results to projections.
 * Labels must match those used in $colocate.
 */
const parseResult = createExecutionResultParser({
  userCard: { projection: userCardProjection },
  postList: postListFragment,
});

/**
 * UserPage demonstrates the colocation pattern:
 * 1. Each component defines its data requirements (fragment + projection)
 * 2. $colocate composes fragments with unique prefixes
 * 3. Parser distributes results back to each component
 */
export const UserPage = () => {
  // Mock execution result for demonstration
  const mockResult = parseResult({
    type: "graphql",
    body: {
      data: {
        // Fields are prefixed by $colocate labels
        userCard_user: {
          id: "1",
          name: "Alice",
          email: "alice@example.com",
        },
        postList_user: {
          posts: [
            { id: "1", title: "Hello World" },
            { id: "2", title: "GraphQL is awesome" },
          ],
        },
      },
    },
  });

  return (
    <div>
      <h2>User Page (Colocation Demo)</h2>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        This page demonstrates composing multiple colocated fragments with @soda-gql/colocation-tools.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <UserCard result={mockResult.userCard} />
        <PostList result={mockResult.postList} />
      </div>
    </div>
  );
};
