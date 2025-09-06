import { gql } from "@/gql-system";
import { useQuery } from "@/gql-system/react";
import { getPostApis } from "../../../../entities/post/apis/get-post.api";
import { listUsersApis } from "../../../entities/user/apis/list-users.api";

export default function PostDetailPage() {
  const { id } = useParams();

  const { data } = useQuery(
    gql.query.document(
      [
        "PostDetailPage_getPost",
        {
          postId: gql.arg.uuid(),
          commentCount: gql.arg.int(),
        },
      ],
      (_, args) => ({
        post: getPostApis.getPost({
          id: args.postId,
          commentCount: args.commentCount,
        }),
        users: listUsersApis.iterateUsers(),
      })
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
        }
  );

  return <div>PostDetailPage</div>;
}
