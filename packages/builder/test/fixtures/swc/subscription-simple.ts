import { gql } from "../../graphql-system";

const postCreatedSlice = gql.default(({ subscription }) =>
  subscription.slice(
    {
      variables: [],
    },
    ({ f }) => [
      //
      f.postCreated()(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
    ({ select }) => select(["$.postCreated"], (result) => result.safeUnwrap(([post]) => post)),
  ),
);

export const postCreatedSubscription = gql.default(({ subscription }) =>
  subscription.composed(
    {
      operationName: "PostCreated",
      variables: [],
    },
    () => ({
      post: postCreatedSlice.embed(),
    }),
  ),
);
