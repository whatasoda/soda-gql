import { gql } from "@/graphql-system";

const userUpdatedSlice = gql.default(({ subscription }, { $ }) =>
  subscription.slice(
    {
      variables: [$("userId").scalar("ID:!")],
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

export const userUpdatedSubscription = gql.default(({ subscription }, { $ }) =>
  subscription.composed(
    {
      operationName: "UserUpdated",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userUpdatedSlice.build({ userId: $.userId }),
    }),
  ),
);
