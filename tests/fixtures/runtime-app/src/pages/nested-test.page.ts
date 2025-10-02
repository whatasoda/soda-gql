import { userWithPostsModel, createUserQueries, queryFactory, nestedQueries } from "@/entities/nested-definitions";

// Use the exported definitions to ensure they're included in the graph
export const testPage = {
  model: userWithPostsModel,
  queries: createUserQueries(),
  factory: queryFactory(),
  nestedQueries,
};
