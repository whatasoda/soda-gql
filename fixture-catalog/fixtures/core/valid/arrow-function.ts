import { gql } from "../../../graphql-system";

const factory = () => {
  const fragment = gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());
  return fragment;
};
