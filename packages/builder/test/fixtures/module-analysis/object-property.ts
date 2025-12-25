import { gql } from "../../codegen-fixture/graphql-system";

const config = {
  models: {
    user: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
  },
};
