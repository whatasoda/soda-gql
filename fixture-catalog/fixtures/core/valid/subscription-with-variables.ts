import { gql } from "../../../graphql-system";

export const taskUpdatedSubscription = gql.default(({ subscription, $var }) =>
  subscription.operation({
    name: "TaskUpdated",
    variables: { ...$var("taskId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.taskUpdated({ taskId: $.taskId })(({ f }) => ({ ...f.id(), ...f.title() })) }),
  }),
);
