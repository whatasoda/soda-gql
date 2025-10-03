import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({
    id: f.id(),
  }), (value) => value)
);
