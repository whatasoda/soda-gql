import { gql } from "../../graphql-system";

export const postCreatedSubscription = gql.default(({ subscription }) =>
  subscription.operation({
    name: "PostCreated",
    fields: ({ f }) => ({ ...f.postCreated()(({ f }) => ({ ...f.id(), ...f.title() })) }),
  }),
);
