import { createUserQueries, nestedQueries, queryFactory, userWithPostsModel } from "./nested-definitions";

// Use the exported definitions to ensure they're included in the graph
export const testPage = {
  model: userWithPostsModel,
  queries: createUserQueries(),
  factory: queryFactory(),
  nestedQueries,
};
