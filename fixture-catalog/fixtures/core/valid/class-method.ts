import { gql } from "../../../graphql-system";

class UserRepository {
  getFragments() {
    const fragment = gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")`{ id }`());
    return fragment;
  }
}
