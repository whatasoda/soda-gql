import { gql } from "../../../../../graphql-system";

export const postFragment = gql.default(({ fragment }) =>
  fragment`fragment PostFragment on Task { id title completed }`(),
);
