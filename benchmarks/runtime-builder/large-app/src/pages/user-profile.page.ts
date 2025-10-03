import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const userProfileQuery = gql.default(({ operation }) =>
  operation.query({}, () => ({
    ...userSlice.fragment(),
  })),
);
