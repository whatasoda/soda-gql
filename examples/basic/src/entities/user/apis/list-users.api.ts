import { gql } from "@/gql-system";
import { user_remoteModel } from "../models/user.remote-model";

export const listUsersApis = {
  iterateUsers: gql.querySlice(
    [{}],
    ({ f }) => ({
      ...f.users({}, () => ({
        ...user_remoteModel.forIterate.fragment({}),
      })),
    }),
    ({ select }) =>
      select("$.users", (result) => result.safeUnwrap((data) => data.map((user) => user_remoteModel.forIterate.transform(user)))),
  ),
};
