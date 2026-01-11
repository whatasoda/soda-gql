import { gql } from "../../../graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
      },
    };
  }
}
