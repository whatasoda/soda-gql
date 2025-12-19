import { gql } from "@/graphql-system";
// @ts-expect-error - This is a test
import * as user from "../entities/user";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.composed(
    {
      operationName: "ProfilePageQuery",
      variables: [$var("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      profile: user.slice.findById.embed({ id: $.userId }),
    }),
  ),
);
