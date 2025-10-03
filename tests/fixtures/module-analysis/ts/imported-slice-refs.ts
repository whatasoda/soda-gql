import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      users: userSlice({ id: $.userId }),
    }),
  )
);
