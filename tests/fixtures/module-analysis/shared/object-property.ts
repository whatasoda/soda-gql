import { gql } from "@/graphql-system";

const config = {
  models: {
    user: gql.default(({ model }) =>
      model({ typename: "User" }, ({ f }) => ({ ...f.id() }), (v) => v),
    ),
  },
};
