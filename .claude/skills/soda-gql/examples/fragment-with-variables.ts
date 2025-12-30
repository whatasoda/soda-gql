/**
 * Fragment with Variables Example
 *
 * Fragments can declare their own variables for conditional fields
 * and parameterized nested selections.
 */
import { gql } from "@/graphql-system";

// Fragment with variables for conditional and parameterized fields
export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: {
      ...$var("includeEmail").Boolean("?"),
      ...$var("postLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.email(),
      // Parameterized nested selection
      ...f.posts({ limit: $.postLimit })(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

// Fragment input type includes declared variables
type UserFragmentInput = typeof userFragment.$infer.input;
// { includeEmail?: boolean; postLimit?: number }

// Fragment output type reflects conditional fields
type UserFragmentOutput = typeof userFragment.$infer.output;
// { id: string; name: string; email?: string; posts: Array<{ id: string; title: string }> }
