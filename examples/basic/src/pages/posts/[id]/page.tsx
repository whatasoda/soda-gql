import { gql } from "@/gql-system";
import { useQuery } from "@/gql-system/react";
import { getPostApis } from "../../../entities/post/apis/get-post.api";
import { listUsersApis } from "../../../entities/user/apis/list-users.api";
import { PostDetail } from "../../../features/post/view-post-detail/components/PostDetail";
import { UserSelect } from "../../../features/user/select-user/components/UserSelect";

export default function PostDetailPage() {
  const { id } = useParams();

  const { data } = useQuery(
    gql.query(
      [
        "PostDetailPage_getPost",
        {
          postId: gql.arg.uuid(),
          commentCount: gql.arg.int(),
        },
      ],
      ({ args }) => ({
        post: getPostApis.getPost.slice({
          id: args.postId,
          commentCount: args.commentCount,
        }),
        users: listUsersApis.iterateUsers.slice(),
      }),
    ),
    id
      ? {
          variables: {
            postId: id,
            commentCount: 10,
          },
        }
      : {
          skip: true,
        },
  );

  return (
    <>
      <PostDetail post={data.post} />
      <UserSelect users={data.users} />
    </>
  );
}
