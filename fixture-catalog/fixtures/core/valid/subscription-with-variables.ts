import { gql } from "../../../graphql-system";

export const taskUpdatedSubscription = gql.default(({ subscription }) =>
  subscription("TaskUpdated")`($taskId: ID!) { taskUpdated(taskId: $taskId) { id title } }`(),
);
