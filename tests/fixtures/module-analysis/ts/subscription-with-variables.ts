import { gql } from "@/graphql-system";

const userUpdatedSlice = gql.default(({ slice }, { $ }) =>
  slice.subscription(
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

export const userUpdatedSubscription = gql.default(({ operation }, { $ }) =>
  operation.subscription(
    {
      operationName: "UserUpdated",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userUpdatedSlice.embed({ userId: $.userId }),
    }),
  ),
);
