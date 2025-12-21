import { gql } from "../../graphql-system";

const buildSlice = () => {
  const invalid = gql.default(({ query }) =>
    query.slice(
      { variables: [] },
      // @ts-expect-error - Test fixture with invalid arguments
      () => ({}),
      () => ({})
    )
  );
  return invalid;
};

export const userSlice = buildSlice();
