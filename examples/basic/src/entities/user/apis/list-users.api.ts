import { gql } from "@/gql-system";
import { user_remoteModel } from "../models/user.remote-model";

export const listUsersApis = {
  iterateUsers: gql.model(
    "query",
    ({ fields }) => ({
      ...fields.users({}, user_remoteModel.forIterate.inline()),
    }),
    (data) => data?.users ?? [],
  ),
};
