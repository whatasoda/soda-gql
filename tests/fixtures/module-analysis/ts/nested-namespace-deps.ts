import { gql } from "@/graphql-system";
import * as user from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      profile: user.slice.findById({ id: $.userId }),
    }),
  )
);
