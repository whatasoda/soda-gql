import { gql } from "../../../../../tests/codegen-fixture/graphql-system";

export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [f.id(), f.name(), f.posts({ categoryId: $.categoryId })(({ f }) => [f.id(), f.title()])],
  ),
);

export const userRemote = {
  forIterate: gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name()])),
};

export const usersQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUsers",
      variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(({ f }) => [f.id(), f.name()]),
    ],
  ),
);

export const usersQueryCatalog = {
  byId: gql.default(({ query }, { $var }) =>
    query.operation(
      {
        name: "GetUsersById",
        variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
      },
      ({ f, $ }) => [
        f.users({
          id: [$.id],
          categoryId: $.categoryId,
        })(({ f }) => [f.id(), f.name()]),
      ],
    ),
  ),
};
