import { gql } from "../../../graphql-system";

export const taskCreatedSubscription = gql.default(({ subscription }) =>
  subscription.operation({
    name: "PostCreated",
    fields: ({ f }) => ({ ...f.taskCreated()(({ f }) => ({ ...f.id(), ...f.title() })) }),
  }),
);
