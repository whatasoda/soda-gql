import { gql } from "../../codegen-fixture/graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })),
      },
    };
  }
}
