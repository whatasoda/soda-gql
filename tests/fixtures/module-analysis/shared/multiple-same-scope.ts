import { gql } from "@/graphql-system";

const container = {
  model1: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({ ...f.id() }),
      (v) => v,
    ),
  ),
  model2: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({ ...f.id() }),
      (v) => v,
    ),
  ),
  model3: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({ ...f.id() }),
      (v) => v,
    ),
  ),
};
