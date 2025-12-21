import { gql } from "../../graphql-system";

export const user_remoteModel = {
  forIterate: gql.default(({ model }) =>
    model.User(
      {},
      ({ f }) => [
        //
        f.id(),
      ],
      (data) => data
    )
  ),
};
