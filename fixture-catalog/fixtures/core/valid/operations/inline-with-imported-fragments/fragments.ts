import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name(), ...f.email() }) }),
);
