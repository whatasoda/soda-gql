import { gql } from "../../graphql-system";

class UserRepository {
  getFragments() {
    const fragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
    return fragment;
  }
}
