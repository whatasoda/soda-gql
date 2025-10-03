import { gql } from "@/graphql-system";

export const user_remoteModel = {
  forIterate: gql.default(({ model }) =>
    model(
      { typename: "User" },
      ({ f }) => ({
        ...f.id(),
      }),
      (data) => data,
    ),
  ),
};
