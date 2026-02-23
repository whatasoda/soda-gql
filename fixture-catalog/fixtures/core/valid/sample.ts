import { gql } from "../../../graphql-system";

// Simple model for testing
export const userFragment = gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id email }`());

// Simple operation for testing
export const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($userId: ID!) { employee(id: $userId) { id email } }`(),
);
