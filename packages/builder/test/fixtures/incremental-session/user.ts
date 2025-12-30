import { gql } from "../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment, $var }) =>
  fragment.User({
    variables: { ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.id(),
      ...f.name(),
      ...f.posts({ categoryId: $.categoryId })(({ f }) => ({ ...f.id(), ...f.title() })),
    }),
  }),
);

export const userRemote = {
  forIterate: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })),
};

export const usersQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUsers",
    variables: { ...$var("id").ID("!"), ...$var("categoryId").ID("?") },
    fields: ({ f, $ }) => ({
      ...f.users({
        id: [$.id],
        categoryId: $.categoryId,
      })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);

export const usersQueryCatalog = {
  byId: gql.default(({ query, $var }) =>
    query.operation({
      name: "GetUsersById",
      variables: { ...$var("id").ID("!"), ...$var("categoryId").ID("?") },
      fields: ({ f, $ }) => ({
        ...f.users({
          id: [$.id],
          categoryId: $.categoryId,
        })(({ f }) => ({ ...f.id(), ...f.name() })),
      }),
    }),
  ),
};
