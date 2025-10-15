import { gql } from "@soda-gql/core";
import { userSlice } from "./slices";

export const getUserQuery = gql.default(({ query }, { $ }) =>
  query("GetUser", { variables: { ...$("userId").scalar("ID:!") } }, ({ getSlice }) => ({
    ...getSlice(userSlice, {}),
  })),
);
