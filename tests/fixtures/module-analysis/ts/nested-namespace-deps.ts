import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import * as user from "../entities/user";

export const pageQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      profile: user.slice.findById({ id: $.userId }),
    }),
  ),
);
