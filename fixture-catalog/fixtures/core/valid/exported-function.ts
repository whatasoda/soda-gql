import { gql } from "../../../graphql-system";

export function getFragment() {
  const fragment = gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());
  return fragment;
}
