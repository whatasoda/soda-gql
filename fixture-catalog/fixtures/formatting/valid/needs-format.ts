import { gql } from "../../../graphql-system";

// Should be formatted - no newline after opening brace
export const fragment1 = gql.default(({ fragment }) => fragment("Fragment1", "Employee")`{ id name }`());

// Nested selections also need formatting
export const fragment2 = gql.default(({ fragment }) =>
  fragment("Fragment2", "Employee")`{
    id
    tasks {
      id
      title
    }
  }`(),
);

// Query operation
export const query1 = gql.default(({ query }) =>
  query.operation({ name: "GetUsers", fields: ({ f }) => ({ ...f.employees({})(({ f }) => ({ ...f.id(), ...f.name() })) }) }),
);
