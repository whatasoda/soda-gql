import { gql } from "@/gql-system";
import { comment_remoteModel } from "../../comment/models/comment.remote-model";
import { user_remoteModel } from "../../user/models/user.remote-model";

export type PostForIterate = gql.infer<typeof post_remoteModel.forIterate>;
export type PostForFeature_showPostDetail = gql.infer<
  typeof post_remoteModel.forFeature_showPostDetail
>;

export const post_remoteModel = {
  forIterate: gql.model(
    "post",
    () => ({
      id: true,
      title: true,
      userId: true,
    }),
    (data) => ({
      id: data.id,
      title: data.title,
      userId: data.userId,
    }),
  ),

  forFeature_showPostDetail: gql.model(
    [
      "post",
      {
        ...gql.input.fromQuery("posts.comments", {
          prefix: "comments_",
          pick: { where: true, limit: true, orderBy: true },
        }),
      },
    ],
    (relation, args) => ({
      id: true,
      title: true,
      content: true,
      userId: true,
      comments: relation(
        [
          "comments",
          {
            where: args.comments_where,
            limit: args.comments_limit,
            orderBy: args.comments_orderBy,
          },
        ],
        [
          comment_remoteModel.forDetail(),
          {
            user: relation("comments.user", user_remoteModel.forReferName()),
          },
        ],
      ),
    }),
    (data) => ({
      id: data.id,
      title: data.title,
      content: data.content,
      userId: data.userId,
      comments: data.comments.map((comment) => ({
        ...comment_remoteModel.forDetail.transform(comment),
        user: user_remoteModel.forReferName.transform(comment.user),
      })),
    }),
  ),
};
