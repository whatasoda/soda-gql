import { gql } from "@/graphql-system";
import { userModel, postModel } from "./models";

export const userWithPostsSlice = gql.default(({ query }, { $ }) =>
  query.slice(
    { variables: [$("id").scalar("ID:!")] },
    ({ f, $ }) => [
      f.user({ id: $.id })(({ f }) => [
        f.id(),
        f.name(),
        f.posts()(({ f }) => [f.id(), f.title()]),
      ]),
    ],
    ({ select }) =>
      select(["$.user"], (user) => ({
        user: userModel.embed({ ...user }),
        posts: user.posts.map((post) => postModel.embed({ ...post })),
      })),
  ),
);
