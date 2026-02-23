import { gql } from "../../../graphql-system";

export const factory = () => {
  return gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());
};
