import { gql } from "@/gql-system";
import { comment_remoteModel } from "../../comment/models/comment.remote-model";
import { user_remoteModel } from "../../user/models/user.remote-model";

export type PostForIterate = gql.infer<typeof post_remoteModel.forIterate>;
export type PostForFeature_showPostDetail = gql.infer<typeof post_remoteModel.forFeature_showPostDetail>;

export const post_remoteModel = {
  forIterate: gql.model(
    "post",
    ({ f }) => ({
      ...f.id(),
      ...f.title(),
      ...f.userId(),
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
        comments_where: gql.fieldArg("post", "comments", "where"),
        comments_limit: gql.fieldArg("post", "comments", "limit"),
        comments_orderBy: gql.fieldArg("post", "comments", "orderBy"),
      },
    ],
    ({ f, $ }) => ({
      ...f.id(),
      postId: f.id().id,
      ...f.title(),
      ...f.content(),
      ...f.userId(),
      ...f.comments(
        {
          where: $.comments_where,
          limit: $.comments_limit,
          orderBy: $.comments_orderBy,
        },
        ({ f }) => ({
          ...comment_remoteModel.forDetail.fragment({}),
          ...f.user(null, () => ({
            ...user_remoteModel.forReferName.fragment({}),
          })),
        }),
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
