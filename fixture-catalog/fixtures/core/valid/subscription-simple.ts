import { gql } from "../../../graphql-system";

export const taskCreatedSubscription = gql.default(({ subscription }) =>
  subscription("PostCreated")`{ taskCreated { id title } }`(),
);
