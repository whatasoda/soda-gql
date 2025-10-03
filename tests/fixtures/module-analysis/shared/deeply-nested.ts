import { gql } from "@/graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ model }) =>
          model("Deep", ({ f }) => ({ id: f.id() }), (v) => v)
        ),
      },
    };
  }
}
