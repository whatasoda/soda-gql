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
      "PostDetailPage_getPost",
      {
        postId: gql.scalar("uuid", "!"),
        commentCount: gql.scalar("int", "?"),
      },
      ({ $ }) => ({
        post: getPostApis.getPost({
          id: $.postId,
          commentCount: $.commentCount,
        }),
        users: listUsersApis.iterateUsers(),
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
