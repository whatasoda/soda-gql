import { gql } from "@/graphql-system";

export const userSlice = gql.default(({ query }, { $var }) =>
  query.slice(
    { variables: [$var("id").scalar("ID:!")] },
    ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id(), f.name()])],
    ({ select }) => select(["$.user"], (result) => result),
  ),
);

export const updateUserSlice = gql.default(({ mutation }, { $var }) =>
  mutation.slice(
    {
      variables: [$var("id").scalar("ID:!"), $var("name").scalar("String:!")],
    },
    ({ f, $ }) => [f.updateUser({ id: $.id, name: $.name })(({ f }) => [f.id()])],
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);

export const slices = {
  byId: gql.default(({ query }, { $var }) =>
    query.slice(
      { variables: [$var("id").scalar("ID:!")] },
      ({ f, $ }) => [f.user({ id: $.id })(({ f }) => [f.id()])],
      ({ select }) => select(["$.user"], (result) => result),
    ),
  ),
};

const sliceCollection = {
  userSlice: gql.default(({ query }) =>
    query.slice(
      {},
      ({ f }) => [f.users({})(({ f }) => [f.id()])],
      ({ select }) => select(["$.users"], (result) => result),
    ),
  ),
};

export default sliceCollection;
