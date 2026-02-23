// Invalid pattern: namespace import
// The analyzer does not fully support namespace imports like "import * as"
import * as gqlSystem from "../../../../graphql-system";

// This definition will NOT be detected due to namespace import style
export const userFragment = gqlSystem.gql.default(({ fragment }) =>
  fragment("UserFragment", "Employee")`{ id name }`(),
);
