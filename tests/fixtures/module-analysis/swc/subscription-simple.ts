import { gql } from "@/graphql-system";

const postCreatedSlice = gql.default(({ slice }) =>
  slice.subscription(
    {
      variables: {},
    },
    ({ f }) => ({
      ...f.postCreated(undefined, ({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
    ({ select }) => select(["$.postCreated"], (result) => result.safeUnwrap(([post]) => post)),
  ),
);

export const postCreatedSubscription = gql.default(({ operation }) =>
  operation.subscription(
    {
      operationName: "PostCreated",
      variables: {},
    },
    () => ({
      post: postCreatedSlice.build({}),
    }),
  ),
);
