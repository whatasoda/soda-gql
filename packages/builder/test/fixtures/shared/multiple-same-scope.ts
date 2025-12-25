import { gql } from "../../codegen-fixture/graphql-system";

const container = {
  model1: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
  model2: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
  model3: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
};
