import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({ id: f.id() }), (v) => v)
);

const privateModel = gql.default(({ model }) =>
  model("Private", ({ f }) => ({ id: f.id() }), (v) => v)
);
