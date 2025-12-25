import { gql } from "../../codegen-fixture/graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
      },
    };
  }
}
