import { gql } from "@/gql-system";

export type UserForIterate = gql.infer<typeof user_remoteModel.forIterate>;
export type UserForReferName = gql.infer<typeof user_remoteModel.forReferName>;

export const user_remoteModel = {
  forIterate: gql.fragment(
    "user",
    () => ({
      id: true,
      name: true,
    }),
    (data) => ({
      id: data.id,
      name: data.name,
    })
  ),

  forReferName: gql.fragment(
    "user",
    () => ({
      id: true,
      name: true,
    }),
    (data) => ({
      id: data.id,
      name: data.name,
    })
  ),
};
