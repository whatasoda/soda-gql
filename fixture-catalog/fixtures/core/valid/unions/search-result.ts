import { gql } from "../../../../graphql-system";

/**
 * Union type fixture: SearchResult = Employee | Project | Task | Comment
 */
export const searchQuery = gql.default(({ query }) =>
  query`query Search($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      ... on Employee { id name email role }
      ... on Project { id title status priority }
      ... on Task { id title completed }
      ... on Comment { id body }
    }
  }`(),
);

/**
 * Activity feed with ActivityItem union
 */
export const activityFeedQuery = gql.default(({ query }) =>
  query`query ActivityFeed($userId: ID!, $limit: Int) {
    activityFeed(userId: $userId, limit: $limit) {
      ... on Task { id title completed createdAt }
      ... on Comment { id body createdAt }
      ... on Project { id title status createdAt }
    }
  }`(),
);
