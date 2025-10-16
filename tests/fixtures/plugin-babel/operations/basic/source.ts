import { gql } from "@soda-gql/core";

// Stub dependencies for runtime execution
const userSlice = { build: {} as any } as any;
const nestedSlice = { build: {} as any } as any;
const updateUserSlice = { build: {} as any } as any;

export const profileQuery = gql.default(({ operation }, { $ }) =>
  operation.query(
    {
      operationName: "ProfileQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
    }),
  ),
);

export const updateProfileMutation = gql.default(({ operation }, { $ }) =>
  operation.mutation(
    {
      operationName: "UpdateProfile",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.build({ id: $.userId, name: $.name }),
    }),
  ),
);

export const query1 = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "Query1",
    },
    () => ({}),
  ),
);

export const query2 = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "Query2",
    },
    () => ({}),
  ),
);

export const queryWith2Args = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "Query2Args",
    },
    () => ({}),
  ),
);

export const complexQuery = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "ComplexQuery",
    },
    () => ({
      nested: nestedSlice.build({}),
    }),
  ),
);
