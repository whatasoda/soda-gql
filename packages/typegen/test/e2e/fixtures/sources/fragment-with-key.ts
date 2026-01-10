import { gql } from "../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User({
    key: "UserFields",
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);
