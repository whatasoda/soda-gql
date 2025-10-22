import { gql } from "@/graphql-system";

export const postModel = gql.default(({ model }) =>
  model.Post(
    {},
    ({ f }) => [f.id(), f.title(), f.body()],
    (selection) => ({
      id: selection.id,
      title: selection.title,
      body: selection.body,
    }),
  ),
);
