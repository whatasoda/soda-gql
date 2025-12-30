/**
 * Type Inference Usage Example
 *
 * Extract and use TypeScript types from soda-gql definitions.
 * Shows integration with various GraphQL client libraries.
 */
import { gql } from "@/graphql-system";

// Define operations
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("includeEmail").Boolean("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
    }),
  }),
);

export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("includeEmail").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...userFragment.spread({ includeEmail: $.includeEmail }),
      })),
    }),
  }),
);

export const getUsersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: { ...$var("ids").ID("![]!") },
    fields: ({ f, $ }) => ({
      ...f.users({ ids: $.ids })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.posts()(({ f }) => ({
          ...f.id(),
          ...f.title(),
        })),
      })),
    }),
  }),
);

// ============================================
// Type Extraction
// ============================================

// Fragment types
type UserFragmentInput = typeof userFragment.$infer.input;
type UserFragmentOutput = typeof userFragment.$infer.output;

// Operation types
type GetUserVariables = typeof getUserQuery.$infer.input;
type GetUserResult = typeof getUserQuery.$infer.output.projected;

type GetUsersVariables = typeof getUsersQuery.$infer.input;
type GetUsersResult = typeof getUsersQuery.$infer.output.projected;

// Extract nested types
type User = NonNullable<GetUserResult["user"]>;
type UserWithPosts = GetUsersResult["users"][number];
type Post = UserWithPosts["posts"][number];

// ============================================
// Usage with fetch
// ============================================

async function fetchGraphQL<T>(
  document: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  const { data } = await response.json();
  return data;
}

async function getUser(
  variables: GetUserVariables
): Promise<GetUserResult> {
  return fetchGraphQL(getUserQuery.document, variables);
}

// ============================================
// Usage with React Query
// ============================================

/*
import { useQuery } from "@tanstack/react-query";

function useGetUser(userId: string, includeEmail?: boolean) {
  return useQuery({
    queryKey: ["user", userId, includeEmail],
    queryFn: async (): Promise<GetUserResult> => {
      return fetchGraphQL(getUserQuery.document, { userId, includeEmail });
    },
  });
}

// Usage in component
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = useGetUser(userId, true);

  if (isLoading) return <div>Loading...</div>;

  // data is fully typed
  return <div>{data?.user?.name}</div>;
}
*/

// ============================================
// Type-safe query function factory
// ============================================

type GqlElement = {
  document: string;
  $infer: {
    input: Record<string, unknown>;
    output: { projected: unknown };
  };
};

function createQueryFn<T extends GqlElement>(operation: T) {
  return async (
    variables: T["$infer"]["input"]
  ): Promise<T["$infer"]["output"]["projected"]> => {
    return fetchGraphQL(operation.document, variables);
  };
}

// Create typed query functions
const getUser2 = createQueryFn(getUserQuery);
const getUsers = createQueryFn(getUsersQuery);

// Usage - fully typed
async function example() {
  const user = await getUser2({ userId: "123", includeEmail: true });
  console.log(user?.user?.name);

  const users = await getUsers({ ids: ["1", "2", "3"] });
  users?.users.forEach((u) => console.log(u.name));
}
