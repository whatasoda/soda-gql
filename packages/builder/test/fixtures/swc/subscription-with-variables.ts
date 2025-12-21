import { gql } from "../../codegen-fixture/graphql-system";

const userUpdatedSlice = gql.default(({ subscription }, { $var }) =>
  subscription.slice(
    {
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ f, $ }) => [
      //
      f.userUpdated({ userId: $.userId })(({ f }) => [
        //
        f.id(),
        f.name(),
      ]),
    ],
    ({ select }) => select(["$.userUpdated"], (result) => result.safeUnwrap(([user]) => user)),
  ),
);

export const userUpdatedSubscription = gql.default(({ subscription }, { $var }) =>
  subscription.composed(
    {
      operationName: "UserUpdated",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userUpdatedSlice.embed({ userId: $.userId }),
    }),
  ),
);
