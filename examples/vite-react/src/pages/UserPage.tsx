import { createExecutionResultParser } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";
import { userCardFragment } from "../components/UserCard/fragment";
import { userCardProjection } from "../components/UserCard/projection";
import { UserCard } from "../components/UserCard";

/**
 * Operation that composes fragments using $colocate.
 * Each label (e.g., "userCard") must match the parser's label.
 */
export const userPageQuery = gql.default(({ query }, { $var, $colocate }) =>
  query.operation({ name: "UserPage", variables: [$var("userId").scalar("ID:!")] }, ({ $}) => [
    ...$colocate({
      userCard: userCardFragment.embed({ userId: $.userId }),
    }),
  ]),
);

/**
 * Parser that maps execution results to projections.
 * Labels must match those used in $colocate.
 */
const parseResult = createExecutionResultParser({
  userCard: { projection: userCardProjection },
});

/**
 * UserPage demonstrates the colocation pattern:
 * 1. Fragment defines data requirements (colocated with component)
 * 2. Projection defines data transformation
 * 3. $colocate composes fragments with unique prefixes
 * 4. Parser distributes results back to projections
 */
export const UserPage = () => {
  // Mock execution result for demonstration
  // In real app, this would come from GraphQL client
  const mockResult = parseResult({
    type: "graphql",
    body: {
      data: {
        // Note: field is prefixed with "userCard_" by $colocate
        userCard_user: {
          id: "1",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
  });

  return (
    <div>
      <h2>User Page (Colocation Demo)</h2>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        This page demonstrates the fragment colocation pattern using @soda-gql/colocation-tools.
      </p>
      <UserCard result={mockResult.userCard} />
    </div>
  );
};
