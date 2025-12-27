import { gql } from "../../../codegen-fixture/graphql-system";

export const postFragment = gql.default(({ fragment }) =>
  fragment.Post(
    {},
    ({ f }) => [f.id(), f.title(), f.body()],
    (selection) => ({
      id: selection.id,
      title: selection.title,
      body: selection.body,
    }),
  ),
);
