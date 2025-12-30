/**
 * Basic Operation Example
 *
 * A simple query operation with a required variable.
 * Operations define complete GraphQL queries/mutations/subscriptions.
 */
import { gql } from "@/graphql-system";

// Simple query operation
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  }),
);

// Extract types from the operation
type GetUserVariables = typeof getUserQuery.$infer.input;
// { userId: string }

type GetUserResult = typeof getUserQuery.$infer.output.projected;
// { user: { id: string; name: string; email: string } | null }

// Usage example (conceptual)
async function fetchUser(userId: string): Promise<GetUserResult> {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: getUserQuery.document,
      variables: { userId } satisfies GetUserVariables,
    }),
  });
  const { data } = await response.json();
  return data;
}
