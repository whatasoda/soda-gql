import { gql } from "../../../graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ fragment }) => fragment`fragment DeepFragment on Employee { id }`()),
      },
    };
  }
}
