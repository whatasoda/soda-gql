import { createProjection } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for PostList component.
 * Fetches posts for a specific user.
 */
export const postListFragment = gql.default(({ model }, { $var }) =>
  model.Query({ variables: [$var("userId").scalar("ID:!")] }, ({ f, $ }) => [
    f.user({ id: $.userId })(({ f }) => [f.posts({})(({ f }) => [f.id(), f.title()])]),
  ]),
);

/**
 * Projection for PostList component.
 */
export const postListProjection = createProjection(postListFragment, {
  paths: ["$.user.posts"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, posts: null };
    if (result.isEmpty()) return { error: null, posts: null };
    const data = result.unwrap();
    return { error: null, posts: data.user?.posts ?? [] };
  },
});
