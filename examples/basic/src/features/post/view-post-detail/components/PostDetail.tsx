import type { PostForFeature_showPostDetail } from "../../../../entities/post/models/post.remote-model";

type Props = {
  post: PostForFeature_showPostDetail | null;
};

export const PostDetail: React.FC<Props> = ({ post }) => {
  return <div>{post.title}</div>;
};
