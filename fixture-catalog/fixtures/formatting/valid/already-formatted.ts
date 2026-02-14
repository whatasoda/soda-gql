import { gql } from "../../../graphql-system";

// Already has newline - should be skipped
export const fragment1 = gql.default(({ fragment }) =>
  fragment`fragment Fragment1 on Employee { id name }`(),
);

// Nested with newlines
export const fragment2 = gql.default(({ fragment }) =>
  fragment`fragment Fragment2 on Employee {
    id
    tasks {
      id
      title
    }
  }`(),
);
