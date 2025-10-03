import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model(
    { typename: "User" },
    ({ f }) => ({
      ...f.id(),
    }),
    (value) => value,
  ),
);
