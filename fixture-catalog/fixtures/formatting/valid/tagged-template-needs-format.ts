import { gql } from "../../../graphql-system";

// Curried query - single-line should be formatted to multi-line
export const query1 = gql.default(({ query }) =>
  query("GetUsers")`{ employees { id name email } }`
);

// Curried fragment - single-line
export const fragment1 = gql.default(({ fragment }) =>
  fragment("UserFields", "Employee")`{ id name email }`()
);

// Curried mutation
export const mutation1 = gql.default(({ mutation }) =>
  mutation("CreateUser")`($input: CreateUserInput!) { createUser(input: $input) { id name } }`
);
