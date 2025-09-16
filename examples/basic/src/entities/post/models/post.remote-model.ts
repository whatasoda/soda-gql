import { gql } from "@/gql-system";
import { comment_remoteModel } from "../../comment/models/comment.remote-model";
import { user_remoteModel } from "../../user/models/user.remote-model";

export type PostForIterate = gql.infer<typeof post_remoteModel.forIterate>;
export type PostForFeature_showPostDetail = gql.infer<typeof post_remoteModel.forFeature_showPostDetail>;

export const post_remoteModel = {
  forIterate: gql.model(
    "post",
    ({ fields }) => ({
      ...fields.id(),
      ...fields.title(),
      ...fields.userId(),
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
        comments_where: gql.input.fromTypeField("posts", "comments", "where"),
        comments_limit: gql.input.fromTypeField("posts", "comments", "limit"),
        comments_orderBy: gql.input.fromTypeField("posts", "comments", "orderBy"),
      },
    ],
    ({ fields, args }) => ({
      ...fields.id(),
      postId: fields.id().id,
      ...fields.title(),
      ...fields.content(),
      ...fields.userId(),
      ...fields.comments(
        {
          where: args.comments_where,
          limit: args.comments_limit,
          orderBy: args.comments_orderBy,
        },
        gql.inlineModel("comment", ({ fields }) => ({
          ...comment_remoteModel.forDetail.fields(),
          ...fields.user(null, user_remoteModel.forReferName()),
        })),
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
