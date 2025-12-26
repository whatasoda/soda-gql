import { createProjection } from "@soda-gql/colocation-tools";
import { userCardFragment } from "./fragment";

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
