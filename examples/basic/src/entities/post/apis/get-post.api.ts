import { gql } from "@/gql-system";
import { post_remoteModel } from "../models/post.remote-model";

export const getPostApis = {
  getPost: gql.querySlice(
    [
      {
        id: gql.scalar("uuid", "!"),
        commentCount: gql.scalar("int", "?"),
      },
    ],
    ({ f, $ }) => ({
      ...f.posts(
        {
          where: { id: { _eq: $.id } },
        },
        () => ({
          ...post_remoteModel.forFeature_showPostDetail.fragment({}),
        }),
      ),
    }),
    ({ select }) =>
      select("$.posts", (result) =>
        result.safeUnwrap((data) => data.map((post) => post_remoteModel.forFeature_showPostDetail.transform(post))),
      ),
  ),
};
