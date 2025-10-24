import { gql } from "@/graphql-system";
import { postModel, userModel } from "./models";

export const userWithPostsSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("id").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.id })(() => [userModel.fragment(), f.posts({})(() => [postModel.fragment()])])],
    ({ select }) =>
      select(["$.user"], (result) =>
        result.safeUnwrap(([user]) => ({
          user: user ? userModel.normalize({ id: user.id, name: user.name, email: user.email }) : null,
          posts: user?.posts.map((post) => postModel.normalize(post)) ?? [],
        })),
      ),
  ),
);
