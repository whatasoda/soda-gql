import { publicModel, createUserQueries, queryFactory, QueryBuilder, queries } from "@/entities/nested-definitions";

// Use the exported definitions to ensure they're included in the graph
export const testPage = {
  model: publicModel,
  queries: createUserQueries(),
  factory: queryFactory(),
  builder: new QueryBuilder(),
  nestedQueries: queries,
};
