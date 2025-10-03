import { gql } from "@/graphql-system";

export const factory = () => {
  return gql.default(({ model }) =>
    model({ typename: "User" }, () => ({}), (value) => value),
  );
};
