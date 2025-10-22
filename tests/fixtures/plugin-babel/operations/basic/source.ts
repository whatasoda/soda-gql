import { gql } from "@/graphql-system";

// Stub dependencies for runtime execution
const userSlice: any = {
  embed(_args: any) {
    return {};
  },
};
const nestedSlice: any = {
  embed(_args: any) {
    return {};
  },
};
const updateUserSlice: any = {
  embed(_args: any) {
    return {};
  },
};

export const profileQuery = gql.default(({ query }, { $ }) =>
  query.composed(
    {
      operationName: "ProfileQuery",
      variables: [$("userId").scalar("ID:!")],
    },
    ({ $ }) => ({
      user: userSlice.embed({ id: $.userId }),
    }),
  ),
);

export const updateProfileMutation = gql.default(({ mutation }, { $ }) =>
  mutation.composed(
    {
      operationName: "UpdateProfile",
      variables: [$("userId").scalar("ID:!"), $("name").scalar("String:!")],
    },
    ({ $ }) => ({
      result: updateUserSlice.embed({ id: $.userId, name: $.name }),
    }),
  ),
);

export const query1 = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "Query1",
    },
    () => ({}),
  ),
);

export const query2 = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "Query2",
    },
    () => ({}),
  ),
);

export const queryWith2Args = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "Query2Args",
    },
    () => ({}),
  ),
);

export const complexQuery = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "ComplexQuery",
    },
    () => ({
      nested: nestedSlice.embed({}),
    }),
  ),
);
