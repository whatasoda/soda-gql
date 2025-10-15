import { gql } from "@soda-gql/core";

export const userSlice = gql.default(({ slice }, { $ }) =>
  slice.query(
    { variables: { ...$("id").scalar("ID:!") } },
    ({ f, $ }) => ({
      user: f.user({ id: $.id }, ({ f }) => ({ ...f.id(), ...f.name() })),
    }),
    ({ select }) => select(["$.user"], (result) => result.map((entry) => entry)),
  ),
);

export const updateUserSlice = gql.default(({ slice }, { $ }) =>
  slice.mutation(
    {
      variables: {
        ...$("id").scalar("ID:!"),
        ...$("name").scalar("String:!"),
      },
    },
    ({ f, $ }) => ({
      updateUser: f.updateUser({ id: $.id, name: $.name }, ({ f }) => ({ ...f.id() })),
    }),
    ({ select }) => select(["$.updateUser"], (result) => result),
  ),
);

export const slices = {
  byId: gql.default(({ slice }, { $ }) =>
    slice.query(
      { variables: { ...$("id").scalar("ID:!") } },
      ({ f, $ }) => ({
        user: f.user({ id: $.id }, ({ f }) => ({ ...f.id() })),
      }),
      ({ select }) => select(["$.user"], (result) => result),
    ),
  ),
};

const sliceCollection = {
  userSlice: gql.default(({ slice }) =>
    slice.query(
      {},
      ({ f }) => ({
        users: f.users(({ f }) => ({ ...f.id() })),
      }),
      ({ select }) => select(["$.users"], (result) => result),
    ),
  ),
};

export default sliceCollection;
