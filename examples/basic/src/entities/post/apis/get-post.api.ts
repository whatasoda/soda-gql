import { gql } from '@/gql-system'
import { post_remoteModel } from '../models/post.remote-model'

export const getPostApis = {
  getPost: gql.querySlice(
    [
      'getPost',
      {
        id: gql.arg.uuid(),
        commentCount: gql.arg.int(),
      },
    ],
    (query, args) => ({
      posts: query(
        ['posts', { where: { id: { _eq: args.id } } }],
        post_remoteModel.forFeature_showPostDetail({
          comments_limit: args.commentCount,
          comments_orderBy: { createdAt: 'desc' },
        }),
      ),
    }),
    (data) => data?.posts?.[0] ?? null,
  ),
}
