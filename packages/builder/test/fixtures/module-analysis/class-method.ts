import { gql } from "../../codegen-fixture/graphql-system";

class UserRepository {
  getFragments() {
    const fragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));
    return fragment;
  }
}
