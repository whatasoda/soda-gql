import { gql } from "../graphql-system";

export const anonymousFragment = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(),
    }),
  }),
);
