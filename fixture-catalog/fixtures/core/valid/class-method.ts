import { gql } from "../../../graphql-system";

class UserRepository {
  getFragments() {
    const fragment = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
    return fragment;
  }
}
