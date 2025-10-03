import { gql } from "@/graphql-system";

export const adminModel = gql.admin(({ model }) =>
  model("AdminUser", ({ f }) => ({
    id: f.id(),
    role: f.role(),
  }), (value) => value)
);

export const defaultQuery = gql.default(({ query }) =>
  query("DefaultData", {}, () => ({
    status: "ok",
  }))
);
