import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

type ProfileQueryVariables = {
  readonly userId: string;
  readonly categoryId?: string;
};

export const profileQuery = gql.query(
  "ProfilePageQuery",
  {
    userId: gql.scalar("ID", "!"),
    categoryId: gql.scalar("ID", "?"),
  },
  ({ $ }) => ({
    users: userSlice({
      id: $.userId,
      categoryId: $.categoryId,
    }),
  }),
);

export type ProfileQuery = typeof profileQuery;
export type ProfileQueryVariablesInput = ProfileQueryVariables;
