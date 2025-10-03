import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const userProfileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "UserProfile",
      variables: {
        ...$("id").scalar("ID:!"),
      },
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.id }),
    }),
  ),
);
