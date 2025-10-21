import { gql } from "@soda-gql/core";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);
