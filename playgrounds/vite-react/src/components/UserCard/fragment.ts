import { createProjection } from "@soda-gql/colocation-tools";
import { gql } from "@/graphql-system";

/**
 * Fragment for UserCard component.
 * Defines the data requirements colocated with the component.
 */
export const userCardFragment = gql.default(({ fragment }, { $var }) =>
  fragment.Query({
    variables: [$var("userId").scalar("ID:!")],
    fields: ({ f, $ }) => [f.user({ id: $.userId })(({ f }) => [f.id(), f.name(), f.email()])],
  }),
);

/**
 * Projection for UserCard component.
 * Defines how to extract and transform data from the execution result.
 */
export const userCardProjection = createProjection(userCardFragment, {
  paths: ["$.user"],
  handle: (result) => {
    if (result.isError()) return { error: result.error, user: null };
    if (result.isEmpty()) return { error: null, user: null };
    const data = result.unwrap();
    return { error: null, user: data.user };
  },
});
