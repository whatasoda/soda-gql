import { gql } from "../../codegen-fixture/graphql-system";

const model1 = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
const model2 = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));

function factory() {
  const model1 = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
  const model2 = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
}
