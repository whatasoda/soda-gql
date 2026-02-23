import { gql } from "../../../graphql-system";

function createModels() {
  const nested = gql.default(({ fragment }) => fragment("NestedFragment", "Employee")`{ id }`());
  return nested;
}
