import { gql } from "../../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User(
    {},
    ({ f }) => [f.id(), f.name(), f.email()],
    (selection) => ({
      id: selection.id,
      name: selection.name,
      email: selection.email,
    }),
  ),
);
