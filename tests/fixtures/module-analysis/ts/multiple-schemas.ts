import { gql } from "@/graphql-system";

// @ts-expect-error - Testing multiple schemas (admin schema doesn't exist in test)
export const adminModel = gql.admin(({ model }) =>
  model.User(
    {},
    // @ts-expect-error - role field doesn't exist in default schema
    ({ f }) => [
      //
      f.id(),
      f.role(),
    ],
    // @ts-expect-error - any type for test
    (value) => value,
  ),
);

export const defaultQuery = gql.default(({ query }) =>
  query.composed(
    {
      operationName: "DefaultData",
      variables: [],
    },
    () => {
      // Test fixture: using any to create a mock slice
      const fakeSlice: any = undefined;
      return {
        users: fakeSlice.build({}),
      };
    },
  ),
);
