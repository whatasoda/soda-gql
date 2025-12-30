import { gql } from "../../codegen-fixture/graphql-system";

export const userUpdatedSubscription = gql.default(({ subscription, $var }) =>
  subscription.operation({
    name: "UserUpdated",
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({ ...f.userUpdated({ userId: $.userId })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);
