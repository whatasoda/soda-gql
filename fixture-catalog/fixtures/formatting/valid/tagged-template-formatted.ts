import { gql } from "../../../graphql-system";

// Already multi-line - should be skipped
export const query1 = gql.default(({ query }) =>
  query("GetUsers")`{
    employees {
      id
      name
      email
    }
  }`
);

// Fragment already formatted
export const fragment1 = gql.default(({ fragment }) =>
  fragment("UserFields", "Employee")`{
    id
    name
    email
  }`()
);
