import { gql } from "@/gql-system";
import { user_remoteModel } from "../models/user.remote-model";

export const listUsersApis = {
  iterateUsers: gql.querySlice(
    "iterateUsers",
    (query) => ({
      users: query("users", user_remoteModel.forIterate()),
    }),
    (data) => data?.users ?? [],
  ),
};
