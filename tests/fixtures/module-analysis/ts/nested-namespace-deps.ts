import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import * as user from "../entities/user";

export const pageQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      profile: user.slice.findById.embed({ id: $.userId }),
    }),
  ),
);
