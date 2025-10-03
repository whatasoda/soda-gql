import { gql } from "@/graphql-system";

// @ts-expect-error - Testing multiple schemas (admin schema doesn't exist in test)
export const adminModel = gql.admin(({ model }) =>
  model(
    { typename: "User" },
    // @ts-expect-error - role field doesn't exist in default schema
    ({ f }) => ({
      ...f.id(),
      ...f.role(),
    }),
    // @ts-expect-error - any type for test
    (value) => value,
  ),
);

export const defaultQuery = gql.default(({ operation }) =>
  operation.query(
    {
      operationName: "DefaultData",
      variables: {},
    },
    // @ts-expect-error - Test fixture with dummy field
    ({ f }) => ({
      status: "ok",
    }),
  ),
);
