import { gql } from "@/graphql-system";

const config = {
  models: {
    user: gql.default(({ model }) =>
      model("User", ({ f }) => ({ id: f.id() }), (v) => v)
    ),
  },
};
