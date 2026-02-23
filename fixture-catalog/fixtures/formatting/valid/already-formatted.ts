import { gql } from "../../../graphql-system";

// Already has newline - should be skipped
export const fragment1 = gql.default(({ fragment }) =>
  fragment("Fragment1", "Employee")`{ id name }`(),
);

// Nested with newlines
export const fragment2 = gql.default(({ fragment }) =>
  fragment("Fragment2", "Employee")`{
    id
    tasks {
      id
      title
    }
  }`(),
);
