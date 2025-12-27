import { createUserQueries, nestedQueries, queryFactory, userWithPostsFragment } from "./nested-definitions";

// Use the exported definitions to ensure they're included in the graph
export const testPage = {
  fragment: userWithPostsFragment,
  queries: createUserQueries(),
  factory: queryFactory(),
  nestedQueries,
};
