import { gql } from "../../codegen-fixture/graphql-system";

function createModels() {
  const nested = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
  return nested;
}
