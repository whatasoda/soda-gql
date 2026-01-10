import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name(), ...f.email() }) }),
);
