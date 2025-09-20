import { gql } from "@/gql-system";

export type UserForIterate = gql.infer<typeof user_remoteModel.forIterate>;
export type UserForReferName = gql.infer<typeof user_remoteModel.forReferName>;

export const user_remoteModel = {
  forIterate: gql.model(
    "user",
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
    (data) => ({
      id: data.id,
      name: data.name,
    }),
  ),

  forReferName: gql.model(
    "user",
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
    (data) => ({
      id: data.id,
      name: data.name,
    }),
  ),
};
