/**
 * Fragment Spreading Example
 *
 * Spreading fragments in operations to reuse field selections.
 * Variable mappings connect operation variables to fragment variables.
 */
import { gql } from "@/graphql-system";

// Define a reusable fragment with variables
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: {
      ...$var("includeEmail").Boolean("?"),
      ...$var("postLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email({ if: $.includeEmail }),
      ...f.posts({ limit: $.postLimit })(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

// Operation that spreads the fragment
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("showEmail").Boolean("?"),
      ...$var("maxPosts").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        // Spread the fragment with variable mappings
        // Maps operation variables to fragment variables
        ...userFragment.spread({
          includeEmail: $.showEmail, // $.showEmail -> fragment's $.includeEmail
          postLimit: $.maxPosts, // $.maxPosts -> fragment's $.postLimit
        }),
      })),
    }),
  }),
);

// Multiple users with the same fragment
export const getUsersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: {
      ...$var("ids").ID("![]!"),
      ...$var("showEmail").Boolean("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.users({ ids: $.ids })(({ f }) => ({
        // Reuse the same fragment
        ...userFragment.spread({
          includeEmail: $.showEmail,
          postLimit: null, // Explicitly pass null for optional variables
        }),
      })),
    }),
  }),
);

// Types are properly inferred through the spread
type GetUserResult = typeof getUserQuery.$infer.output.projected;
type GetUsersResult = typeof getUsersQuery.$infer.output.projected;
