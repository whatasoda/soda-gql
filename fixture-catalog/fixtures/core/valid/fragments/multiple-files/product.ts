import { gql } from "../../../../../graphql-system";

export const postFragment = gql.default(({ fragment }) =>
  fragment.Task({ fields: ({ f }) => ({ ...f.id(), ...f.title(), ...f.completed() }) }),
);
