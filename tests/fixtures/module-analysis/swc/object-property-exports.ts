import { gql } from "@/graphql-system";

export const user_remoteModel = {
  forIterate: gql.default(({ model }) =>
    model(
      "user",
      ({ f }) => ({
        ...f.id(),
      }),
      (data) => data,
    )
  ),
};
