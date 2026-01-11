import { gql } from "../../../../../graphql-system";

export const postFragment = gql.default(({ fragment }) =>
  fragment.Post({ fields: ({ f }) => ({ ...f.id(), ...f.title(), ...f.body() }) }),
);
