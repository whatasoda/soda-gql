import { gql } from "@/graphql-system";

const buildSlice = () => {
  const invalid = gql.default(({ slice }) =>
    // @ts-expect-error - Test fixture with invalid arguments
    slice.query({ variables: {} }, () => ({}), () => ({})),
  );
  return invalid;
};

export const userSlice = buildSlice();
