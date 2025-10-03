import { gql } from "@/graphql-system";

const buildSlice = () => {
  const invalid = gql.default(({ querySlice }) => querySlice([], () => ({}), () => ({})));
  return invalid;
};

export const userSlice = buildSlice();
