import { gql } from "../../graphql-system";

export const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
    ],
    (v) => v,
  ),
);

const privateModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
    ],
    (v) => v,
  ),
);
