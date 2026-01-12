import { createProjection } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for SearchResults component.
 * Demonstrates handling Union types (SearchResult = Employee | Project | Task | Comment).
 */
export const searchResultsFragment = gql.default(({ fragment, $var }) =>
  fragment.Query({
    variables: {
      ...$var("query").String("!"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.search({ query: $.query, limit: $.limit })({
        // Union member selections - each type gets its own field selection
        Employee: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.name(),
          ...f.email(),
          ...f.role(),
        }),
        Project: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.title(),
          ...f.status(),
          ...f.priority(),
        }),
        Task: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.title(),
          ...f.completed(),
          ...f.priority(),
        }),
        Comment: ({ f }) => ({
          ...f.__typename(),
          ...f.id(),
          ...f.body(),
        }),
      }),
    }),
  }),
);

/**
 * Projection for SearchResults component.
 */
export const searchResultsProjection = createProjection(searchResultsFragment, {
  paths: ["$.search"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, results: null };
    if (result.isEmpty()) return { error: null, results: null };
    const [results] = result.unwrap();
    return { error: null, results: results ?? [] };
  },
});
