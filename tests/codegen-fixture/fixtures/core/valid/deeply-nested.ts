import { gql } from "../../graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })),
      },
    };
  }
}
