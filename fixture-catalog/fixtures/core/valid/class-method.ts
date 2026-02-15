import { gql } from "../../../graphql-system";

class UserRepository {
  getFragments() {
    const fragment = gql.default(({ fragment }) => fragment`fragment EmployeeFragment on Employee { id }`());
    return fragment;
  }
}
