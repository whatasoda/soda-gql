import { gql } from "../../../../../graphql-system";

/**
 * Fragment with a key - should be included in PrebuiltTypes.
 * This tests that keyed fragments are correctly resolved.
 */
export const keyedUserFields = gql.default(({ fragment }) =>
  fragment("KeyedUserFields", "Employee")`{ id name }`(),
);

/**
 * Another keyed fragment for testing multiple fragments.
 */
export const keyedPostFields = gql.default(({ fragment }) =>
  fragment("KeyedPostFields", "Task")`{ id title }`(),
);
