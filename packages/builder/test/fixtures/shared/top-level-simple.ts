import { gql } from "../../codegen-fixture/graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
    ],
    (value) => value,
  ),
);
