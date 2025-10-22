import { gql } from "@/graphql-system";

export const model1 = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);

export const model2 = gql.default(({ model }) =>
  model.Post(
    {},
    ({ f }) => [f.id()],
    (selection) => ({ id: selection.id }),
  ),
);
