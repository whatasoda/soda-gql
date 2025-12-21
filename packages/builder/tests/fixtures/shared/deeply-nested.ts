import { gql } from "../../graphql-system";

class Outer {
  method() {
    const obj = {
      nested: {
        deep: gql.default(({ model }) =>
          model.User(
            {},
            ({ f }) => [
              //
              f.id(),
            ],
            (v) => v
          )
        ),
      },
    };
  }
}
