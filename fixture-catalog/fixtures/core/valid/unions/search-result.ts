import { gql } from "../../../../graphql-system";

/**
 * Union type fixture: SearchResult = Employee | Project | Task | Comment
 */
export const searchQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "Search",
    variables: { ...$var("query").String("!"), ...$var("limit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.search({ query: $.query, limit: $.limit })({
        // Union member selections
        Employee: ({ f }) => ({
          ...f.id(),
          ...f.name(),
          ...f.email(),
          ...f.role(),
        }),
        Project: ({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...f.status(),
          ...f.priority(),
        }),
        Task: ({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...f.completed(),
        }),
        Comment: ({ f }) => ({
          ...f.id(),
          ...f.body(),
        }),
      }),
    }),
  }),
);

/**
 * Activity feed with ActivityItem union
 */
export const activityFeedQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "ActivityFeed",
    variables: { ...$var("userId").ID("!"), ...$var("limit").Int("?") },
    fields: ({ f, $ }) => ({
      ...f.activityFeed({ userId: $.userId, limit: $.limit })({
        Task: ({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...f.completed(),
          ...f.createdAt(),
        }),
        Comment: ({ f }) => ({
          ...f.id(),
          ...f.body(),
          ...f.createdAt(),
        }),
        Project: ({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...f.status(),
          ...f.createdAt(),
        }),
      }),
    }),
  }),
);
