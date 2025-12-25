import { gql } from "../../../codegen-fixture/graphql-system";

/**
 * User model
 */
export const simpleUserModel = gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name()]));

/**
 * Post model
 */
export const simplePostModel = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id(), f.title()]));

/**
 * Operation that embeds multiple models in different fields
 */
export const getDashboardQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetDashboard",
      variables: [$var("userId").scalar("ID:!"), $var("postLimit").scalar("Int:?")],
    },
    ({ f, $ }) => [
      f.user({ id: $.userId })(() => [simpleUserModel.embed()]),
      f.posts({ limit: $.postLimit })(() => [simplePostModel.embed()]),
    ],
  ),
);
