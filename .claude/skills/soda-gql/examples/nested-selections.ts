/**
 * Nested Selections Example
 *
 * Complex nested field selections with arguments at multiple levels.
 * Uses curried callback syntax for nested object fields.
 */
import { gql } from "@/graphql-system";

// Query with deeply nested selections
export const getUserWithPostsQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUserWithPosts",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("postLimit").Int("?"),
      ...$var("commentLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      // First level: user query with argument
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),

        // Second level: posts with limit argument
        ...f.posts({ limit: $.postLimit })(({ f }) => ({
          ...f.id(),
          ...f.title(),
          ...f.content(),
          ...f.createdAt(),

          // Third level: author of each post
          ...f.author()(({ f }) => ({
            ...f.id(),
            ...f.name(),
          })),

          // Third level: comments with limit argument
          ...f.comments({ limit: $.commentLimit })(({ f }) => ({
            ...f.id(),
            ...f.body(),
            ...f.createdAt(),

            // Fourth level: comment author
            ...f.author()(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          })),
        })),
      })),
    }),
  }),
);

// The result type reflects the nested structure
type QueryResult = typeof getUserWithPostsQuery.$infer.output.projected;
/*
{
  user: {
    id: string;
    name: string;
    email: string;
    posts: Array<{
      id: string;
      title: string;
      content: string;
      createdAt: Date;
      author: { id: string; name: string };
      comments: Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: { id: string; name: string };
      }>;
    }>;
  } | null;
}
*/
