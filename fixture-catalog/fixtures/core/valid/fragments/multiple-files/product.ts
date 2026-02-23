import { gql } from "../../../../../graphql-system";

export const postFragment = gql.default(({ fragment }) =>
  fragment("PostFragment", "Task")`{ id title completed }`(),
);
