import { gql } from "@/gql-system";

export type CommentForIterate = gql.infer<typeof comment_remoteModel.forIterate>;
export type CommentForDetail = gql.infer<typeof comment_remoteModel.forDetail>;

export const comment_remoteModel = {
  forIterate: gql.model(
    "comment",
    ({ f }) => ({
      ...f.id(),
      ...f.userId(),
      ...f.postId(),
      ...f.createdAt(),
    }),
    (data) => ({
      id: data.id,
      userId: data.userId,
      postId: data.postId,
      createdAt: data.createdAt,
    }),
  ),

  forDetail: gql.model(
    "comment",
    ({ f }) => ({
      ...f.id(),
      ...f.content(),
      ...f.userId(),
      ...f.postId(),
      ...f.createdAt(),
      ...f.updatedAt(),
    }),
    (data) => ({
      id: data.id,
      userId: data.userId,
      content: data.content,
      postId: data.postId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),
  ),
};
