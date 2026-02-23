// Invalid pattern: gql calls in class properties
// Class property scope tracking differs between TSC and SWC,
// causing canonical path mismatches. This pattern is not reliably supported.
import { gql } from "../../../../graphql-system";

class UserRepository {
  // Instance property with gql - unreliable scope tracking
  private userFragment = gql.default(({ fragment }) =>
    fragment("UserFragment", "Employee")`{ id }`(),
  );

  // Static property with gql - also unreliable
  static sharedFragment = gql.default(({ fragment }) =>
    fragment("SharedFragment", "Employee")`{ name }`(),
  );

  getFragment() {
    return this.userFragment;
  }
}

export { UserRepository };
