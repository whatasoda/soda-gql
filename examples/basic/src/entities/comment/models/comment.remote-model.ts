import { gql } from "@/gql-system";

export type CommentForIterate = gql.infer<typeof comment_remoteModel.forIterate>;
export type CommentForDetail = gql.infer<typeof comment_remoteModel.forDetail>;

export const comment_remoteModel = {
  forIterate: gql.model(
    "comment",
    ({ fields }) => ({
      ...fields.id(),
      ...fields.userId(),
      ...fields.postId(),
      ...fields.createdAt(),
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
    ({ fields }) => ({
      ...fields.id(),
      ...fields.content(),
      ...fields.userId(),
      ...fields.postId(),
      ...fields.createdAt(),
      ...fields.updatedAt(),
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
