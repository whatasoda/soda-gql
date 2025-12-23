import { gql } from "../../../../../tests/codegen-fixture/graphql-system";

export const userModel = gql.default(({ model }, { $var }) =>
  model.User(
    {
      variables: [$var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.id(),
      f.name(),
      f.posts({ categoryId: $.categoryId })(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
  ),
);

export const userRemote = {
  forIterate: gql.default(({ model }) =>
    model.User({}, ({ f }) => [
      //
      f.id(),
      f.name(),
    ]),
  ),
};

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
    },
    ({ f, $ }) => [
      //
      f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(() => [
        //
        userModel.fragment({ categoryId: $.categoryId }),
      ]),
    ],
    ({ select }) => select(["$.users"], (result) => result.safeUnwrap(([data]) => data)),
  ),
);

export const userSliceCatalog = {
  byId: gql.default(({ query }, { $var }) =>
    query.slice(
      {
        variables: [$var("id").scalar("ID:!"), $var("categoryId").scalar("ID:?")],
      },
      ({ f, $ }) => [
        //
        f.users({
          id: [$.id],
          categoryId: $.categoryId,
        })(({ f }) => [
          //
          f.id(),
          f.name(),
        ]),
      ],
      ({ select }) => select(["$.users"], (result) => result.safeUnwrap(([data]) => data)),
    ),
  ),
};
