import { gql } from "@/gql-system";

export type CommentForIterate = gql.infer<
  typeof comment_remoteModel.forIterate
>;
export type CommentForDetail = gql.infer<typeof comment_remoteModel.forDetail>;

export const comment_remoteModel = {
  forIterate: gql.model(
    "comment",
    () => ({
      id: true,
      postId: true,
      userId: true,
      createdAt: true,
    }),
    (data) => ({
      id: data.id,
      userId: data.userId,
      postId: data.postId,
      createdAt: data.createdAt,
    })
  ),

  forDetail: gql.model(
    "comment",
    () => ({
      id: true,
      content: true,
      userId: true,
      postId: true,
      createdAt: true,
      updatedAt: true,
    }),
    (data) => ({
      id: data.id,
      userId: data.userId,
      content: data.content,
      postId: data.postId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
  ),
};
