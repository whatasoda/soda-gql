import { gql } from "../../graphql-system";

export const adminModel = gql.admin(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
      f.name(),
    ],
    (value) => value
  )
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
        users: fakeSlice.embed({}),
      };
    }
  )
);
